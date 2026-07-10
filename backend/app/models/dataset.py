"""Dataset metadata model."""
from datetime import datetime, timezone
from app.extensions import db


class Dataset(db.Model):
    __tablename__ = "datasets"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    source = db.Column(db.String(128), default="kaggle")  # kaggle, upload, synthetic
    source_url = db.Column(db.String(1024))
    file_path = db.Column(db.String(1024))
    file_size_mb = db.Column(db.Float)
    n_rows = db.Column(db.BigInteger)
    n_columns = db.Column(db.Integer)
    columns_schema = db.Column(db.JSON)  # {col_name: dtype}
    status = db.Column(db.String(32), default="pending")  # pending, ready, error
    checksum = db.Column(db.String(128))
    description = db.Column(db.Text)
    uploaded_by_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    uploaded_by = db.relationship("User", backref="datasets")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "source": self.source,
            "source_url": self.source_url,
            "file_size_mb": self.file_size_mb,
            "n_rows": self.n_rows,
            "n_columns": self.n_columns,
            "columns_schema": self.columns_schema,
            "status": self.status,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
