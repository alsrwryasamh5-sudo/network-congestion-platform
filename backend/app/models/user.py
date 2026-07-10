"""User model with role-based access control."""
import enum
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db


class RoleEnum(enum.Enum):
    ADMIN = "admin"
    RESEARCHER = "researcher"
    VIEWER = "viewer"


# association table for many-to-many user<->role if needed later
user_roles = db.Table(
    "user_roles",
    db.Column("user_id", db.Integer, db.ForeignKey("users.id"), primary_key=True),
    db.Column("role", db.Enum(RoleEnum, name="role_enum"), primary_key=True),
)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255))
    role = db.Column(db.Enum(RoleEnum, name="role_enum"), nullable=False, default=RoleEnum.VIEWER)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    last_login_at = db.Column(db.DateTime(timezone=True))
    failed_login_count = db.Column(db.Integer, default=0)
    avatar_url = db.Column(db.String(512))
    preferences = db.Column(db.JSON, default=dict)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # relationships
    predictions = db.relationship("Prediction", backref="user", lazy="dynamic")
    experiments = db.relationship("Experiment", backref="user", lazy="dynamic")
    reports = db.relationship("Report", backref="user", lazy="dynamic")
    notifications = db.relationship("Notification", backref="user", lazy="dynamic")
    feedbacks = db.relationship("Feedback", backref="user", lazy="dynamic")
    activity_logs = db.relationship("ActivityLog", backref="user", lazy="dynamic")

    # -- password helpers --
    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    # -- role helpers --
    def has_role(self, role_name: str) -> bool:
        return self.role.value == role_name

    @property
    def is_admin(self) -> bool:
        return self.role == RoleEnum.ADMIN

    @property
    def is_researcher(self) -> bool:
        return self.role in (RoleEnum.ADMIN, RoleEnum.RESEARCHER)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role.value,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
            "avatar_url": self.avatar_url,
            "preferences": self.preferences or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
