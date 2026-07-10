"""
Admin Blueprint
================
 /api/v1/admin/users         - list/create/update/delete users
 /api/v1/admin/experiments   - list experiments
 /api/v1/admin/datasets      - list datasets
 /api/v1/admin/logs          - view system logs
 /api/v1/admin/feedback      - view feedback
"""
from flask import Blueprint, request, g
from app.extensions import db
from app.models.user import User, RoleEnum
from app.models.experiment import Experiment
from app.models.dataset import Dataset
from app.models.system_log import SystemLog, ActivityLog
from app.models.feedback import Feedback
from app.models.notification import Notification
from app.utils.errors import NotFoundError, ValidationError, AuthorizationError
from ._shared import auth_required, paginated

admin_bp = Blueprint("admin", __name__, url_prefix="/api/v1/admin")


@admin_bp.route("/users", methods=["GET"])
@auth_required(roles=("admin",))
def list_users():
    from app.blueprints._shared import paginated
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    q = User.query.order_by(User.created_at.desc())
    return {"success": True, "data": paginated(q, lambda u: u.to_dict(), page, per_page)}


@admin_bp.route("/users/<int:user_id>", methods=["PATCH"])
@auth_required(roles=("admin",))
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}
    if "role" in data:
        try:
            user.role = RoleEnum(data["role"])
        except ValueError:
            raise ValidationError(f"Invalid role: {data['role']}")
    if "is_active" in data:
        user.is_active = bool(data["is_active"])
    if "full_name" in data:
        user.full_name = data["full_name"]
    if "email" in data:
        user.email = data["email"]
    db.session.commit()
    return {"success": True, "data": user.to_dict()}


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@auth_required(roles=("admin",))
def delete_user(user_id):
    if user_id == g.current_user.id:
        raise ValidationError("Cannot delete your own account.")
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return {"success": True, "message": "User deleted."}


@admin_bp.route("/experiments", methods=["GET"])
@auth_required(roles=("admin", "researcher"))
def list_experiments():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    q = Experiment.query.order_by(Experiment.created_at.desc())
    return {"success": True, "data": paginated(q, lambda e: e.to_dict(), page, per_page)}


@admin_bp.route("/datasets", methods=["GET"])
@auth_required(roles=("admin", "researcher"))
def list_datasets():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    q = Dataset.query.order_by(Dataset.created_at.desc())
    return {"success": True, "data": paginated(q, lambda d: d.to_dict(), page, per_page)}


@admin_bp.route("/logs/system", methods=["GET"])
@auth_required(roles=("admin",))
def system_logs():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))
    level = request.args.get("level")
    q = SystemLog.query.order_by(SystemLog.created_at.desc())
    if level:
        q = q.filter(SystemLog.level == level.upper())
    return {"success": True, "data": paginated(q, lambda l: l.to_dict(), page, per_page)}


@admin_bp.route("/logs/activity", methods=["GET"])
@auth_required(roles=("admin",))
def activity_logs():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))
    q = ActivityLog.query.order_by(ActivityLog.created_at.desc())
    return {"success": True, "data": paginated(q, lambda l: l.to_dict(), page, per_page)}


@admin_bp.route("/feedback", methods=["GET"])
@auth_required(roles=("admin",))
def list_feedback():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    q = Feedback.query.order_by(Feedback.created_at.desc())
    return {"success": True, "data": paginated(q, lambda f: f.to_dict(), page, per_page)}


@admin_bp.route("/feedback", methods=["POST"])
@auth_required()
def create_feedback():
    data = request.get_json() or {}
    fb = Feedback(
        user_id=g.current_user.id,
        category=data.get("category", "general"),
        rating=int(data.get("rating", 5)),
        message=data.get("message", ""),
        contact_email=data.get("contact_email"),
    )
    db.session.add(fb)
    db.session.commit()
    return {"success": True, "data": fb.to_dict()}, 201


@admin_bp.route("/notifications", methods=["GET"])
@auth_required()
def list_notifications():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    q = Notification.query.filter_by(user_id=g.current_user.id).order_by(Notification.created_at.desc())
    return {"success": True, "data": paginated(q, lambda n: n.to_dict(), page, per_page)}


@admin_bp.route("/notifications/<int:notif_id>/read", methods=["PATCH"])
@auth_required()
def mark_notification_read(notif_id):
    n = Notification.query.get_or_404(notif_id)
    if n.user_id != g.current_user.id:
        raise AuthorizationError()
    n.is_read = True
    db.session.commit()
    return {"success": True, "data": n.to_dict()}


@admin_bp.route("/notifications/read-all", methods=["POST"])
@auth_required()
def mark_all_read():
    Notification.query.filter_by(user_id=g.current_user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return {"success": True, "message": "All notifications marked as read."}
