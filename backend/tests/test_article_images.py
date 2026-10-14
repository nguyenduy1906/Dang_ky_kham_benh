"""Upload checks in a disposable database schema and temporary image directory."""
import os
import unittest
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from PIL import Image
from backend.tests import test_nurse_assignment
from backend.app.utils import uploads


@unittest.skipUnless(os.environ.get('RUN_POSTGRES_TESTS') == '1', 'Requires PostgreSQL')
class ArticleImageTests(unittest.TestCase):
    drop_schema = test_nurse_assignment.NurseAssignmentTests.drop_schema
    headers = test_nurse_assignment.NurseAssignmentTests.headers

    def setUp(self):
        test_nurse_assignment.NurseAssignmentTests.setUp(self)
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.directory = Path(directory.name)
        setting = patch.dict(os.environ, {'UPLOAD_DIR': directory.name})
        setting.start()
        self.addCleanup(setting.stop)

    def image(self, fmt='PNG'):
        data = BytesIO()
        Image.new('RGB', (12, 12), 'green').save(data, format=fmt)
        return data.getvalue()

    def post_image(self, path, data, headers=None):
        response = self.client.post(path, headers=headers or self.headers('ADMIN'),
                                    data={'file': (BytesIO(data), 'photo.jpg')})
        self.addCleanup(response.request.close)
        self.addCleanup(response.close)
        self.addCleanup(response.request.environ['wsgi.input'].close)
        return response

    def test_only_admin_can_upload_article_or_other_doctor_images(self):
        for path in ('/admin/articles/images', '/admin/doctors/1/avatar'):
            self.assertEqual(self.client.post(path).status_code, 401)
            for role in ('USER', 'NURSE'):
                self.assertEqual(self.client.post(path, headers=self.headers(role)).status_code, 403)
        self.assertEqual(list(self.directory.iterdir()), [])

    def test_article_formats_public_urls_and_persisting_in_article(self):
        for fmt, ext in (('PNG', 'png'), ('JPEG', 'jpg'), ('WEBP', 'webp')):
            data = self.image(fmt)
            uploaded = self.post_image('/admin/articles/images', data)
            self.assertEqual(uploaded.status_code, 201, uploaded.json)
            url = uploaded.json['url']
            filename = url.rsplit('/', 1)[1]
            self.assertRegex(filename, rf'^[0-9a-f]{{32}}\.{ext}$')
            self.assertEqual((self.directory / 'articles' / filename).read_bytes(), data)
            public = self.client.get(url)
            self.assertEqual(public.status_code, 200)
            self.assertEqual(public.content_type, {'jpg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}[ext])
            self.assertEqual(public.data, data)
            self.assertEqual(public.headers['X-Content-Type-Options'], 'nosniff')
            public.close()
        saved = self.client.patch('/admin/articles/10', headers=self.headers('ADMIN'), json={
            'thumbnail_url': url, 'content': f'Text\n\n![Image]({url} "Caption")'})
        self.assertEqual(saved.status_code, 200, saved.json)
        article = self.client.get('/articles/noi-soi-dai-trang-phat-hien-san-day-bo').json['article']
        self.assertEqual(article['thumbnail_url'], url)
        self.assertIn('Caption', article['content'])
        for filename in ('missing.jpg', '../secret', 'invalid.svg'):
            self.assertEqual(self.client.get('/uploads/articles/' + filename).status_code, 404)

    def test_invalid_missing_empty_and_oversized_article_files_have_no_side_effects(self):
        missing = self.client.post('/admin/articles/images', headers=self.headers('ADMIN'))
        self.assertEqual(missing.json['error']['code'], 'MISSING_FILE')
        for data, code in ((b'', 'EMPTY_FILE'), (b'<svg onload="bad()"/>', 'INVALID_IMAGE'),
                           (self.image()[:20], 'INVALID_IMAGE'),
                           (b'x' * (uploads.MAX_ARTICLE_BYTES + 1), 'FILE_TOO_LARGE')):
            result = self.post_image('/admin/articles/images', data)
            self.assertEqual(result.status_code, 400)
            self.assertEqual(result.json['error']['code'], code)
        self.assertEqual(list(self.directory.iterdir()), [])

    def test_admin_avatar_replaces_old_file_and_invalid_input_keeps_current_avatar(self):
        first = self.post_image('/admin/doctors/1/avatar', self.image())
        self.assertEqual(first.status_code, 200, first.json)
        old_url = first.json['doctor']['avatar_url']
        with self.client.get(old_url) as public:
            self.assertEqual(public.status_code, 200)
        second = self.post_image('/admin/doctors/1/avatar', self.image('JPEG'))
        self.assertEqual(second.status_code, 200)
        new_url = second.json['doctor']['avatar_url']
        self.assertEqual(self.client.get(old_url).status_code, 404)
        invalid = self.post_image('/admin/doctors/1/avatar', b'not an image')
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(self.client.get('/doctors/1').json['doctor']['avatar_url'], new_url)
        missing = self.post_image('/admin/doctors/99999/avatar', self.image())
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(len(list((self.directory / 'avatars').iterdir())), 1)
