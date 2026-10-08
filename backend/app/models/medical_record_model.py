from psycopg.types.json import Jsonb
from backend.app.models._sql import jsonable


def get(db, encounter_id, *, lock=False):
    suffix = ' FOR SHARE' if lock == 'share' else (' FOR UPDATE' if lock else '')
    return db.execute('SELECT * FROM medical_record WHERE encounter_id=%s' + suffix,
                      (encounter_id,)).fetchone()


def append_revision(db, record_id, actor_id, reason, before, after):
    # Snapshot trước/sau cả bệnh án và thuốc, khóa record do service sở hữu.
    from backend.app.services.encounter_service import utc_now
    entry = {'actor_id': actor_id, 'reason': reason, 'changed_at': utc_now().isoformat(),
             'before': jsonable(before), 'after': jsonable(after)}
    db.execute('UPDATE medical_record SET version=version+1,revision_history=revision_history || %s::jsonb '
               'WHERE record_id=%s', (Jsonb([entry]), record_id))
