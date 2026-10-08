from backend.app.db.database import get_db_connection
from backend.app.models import statistics_model as model
from backend.app.models._sql import jsonable
from backend.app.services.encounter_service import require_role


def report(actor, kind, query):
    require_role(actor, 'ADMIN')
    function = {'encounters': model.encounters, 'payments': model.payments, 'reviews': model.reviews, 'audit': model.audit}[kind]
    with get_db_connection() as db:
        db.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
        result = function(db, query)
    return {**jsonable(result), 'page': query['page'], 'page_size': query['page_size'],
            'group_by': query['group_by'], 'from_date': jsonable(query['from_date']), 'to_date': jsonable(query['to_date'])}
