from backend.app.db.database import get_db_connection
from backend.app.models import statistics_model as model
from backend.app.utils.database_helpers import jsonable
from backend.app.core.security import require_role
from psycopg import IsolationLevel


def report(actor, kind, query):
    require_role(actor, 'ADMIN')
    function = {'encounters': model.encounters, 'payments': model.payments, 'reviews': model.reviews, 'audit': model.audit}[kind]
    with get_db_connection(isolation_level=IsolationLevel.REPEATABLE_READ, read_only=True) as db:
        result = function(db, query)
    return {**jsonable(result), 'page': query['page'], 'page_size': query['page_size'],
            'group_by': query['group_by'], 'from_date': jsonable(query['from_date']), 'to_date': jsonable(query['to_date'])}
