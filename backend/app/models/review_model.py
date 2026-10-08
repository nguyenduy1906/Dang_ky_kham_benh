def create(db, record_id, fields):
    return db.execute('INSERT INTO review(record_id,rating,comment) VALUES (%s,%s,%s) RETURNING *',
                      (record_id, fields['rating'], fields['comment'])).fetchone()


def list_public(db, doctor_id, page, size):
    base = ('FROM review r JOIN medical_record m ON m.record_id=r.record_id '
            "JOIN encounter e ON e.encounter_id=m.encounter_id WHERE e.doctor_profile_id=%s AND e.encounter_status='COMPLETED'")
    stats = db.execute('SELECT COUNT(*) AS total,AVG(r.rating) AS average_rating ' + base, (doctor_id,)).fetchone()
    # Không JOIN patient/users, không trả record/encounter ID hoặc bệnh án.
    rows = db.execute('SELECT r.review_id,r.rating,r.comment,r.created_at ' + base +
                      ' ORDER BY r.created_at DESC,r.review_id DESC LIMIT %s OFFSET %s',
                      (doctor_id, size, (page - 1) * size)).fetchall()
    return rows, stats
