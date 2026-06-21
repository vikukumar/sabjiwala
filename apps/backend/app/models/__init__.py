"""Models package - imports all models to register with SQLAlchemy metadata."""
from app.models.user import *  # noqa: F401, F403
from app.models.vendor import *  # noqa: F401, F403
from app.models.product import *  # noqa: F401, F403
from app.models.order import *  # noqa: F401, F403
from app.models.payment import *  # noqa: F401, F403
from app.models.coupon import *  # noqa: F401, F403
from app.models.delivery import *  # noqa: F401, F403
from app.models.notification import *  # noqa: F401, F403
from app.models.cms import *  # noqa: F401, F403
from app.models.storage import *  # noqa: F401, F403
from app.models.support import *  # noqa: F401, F403
from app.models.chat import *  # noqa: F401, F403
from app.models.search import *  # noqa: F401, F403
from app.models.system import *  # noqa: F401, F403
