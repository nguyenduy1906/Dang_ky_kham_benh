import unittest
from backend.app.core.errors import AppError
from backend.app.schemas.encounter_schema import validate_registration, validate_registration_details


class BookingReviewEditTests(unittest.TestCase):
    def details(self, **changes):
        return dict(full_name="Người được khám", phone="0912345678", id_card="001090123456", dob="1990-05-20", **changes)

    def test_registration_normalizes_and_rejects_invalid_or_unrelated_fields(self):
        details = self.details()
        details["phone"] = "+84 912.345.678"
        self.assertEqual(validate_registration_details(details)["phone"], "0912345678")
        self.assertEqual(validate_registration({"registration_details": details, "symptoms": "  Đau đầu  "})["symptoms"], "Đau đầu")
        for payload in (None, {}, {"registration_details": details, "symptoms": " "},
                        {"registration_details": {**details, "user_id": 999}, "symptoms": "Đau đầu"},
                        {"registration_details": {**details, "phone": "123"}, "symptoms": "Đau đầu"},
                        {"registration_details": details, "symptoms": "Đau đầu", "encounter_status": "CONFIRMED"}):
            with self.subTest(payload=str(payload)[:70]), self.assertRaises(AppError) as error:
                validate_registration(payload)
            self.assertEqual(error.exception.status_code, 400)

