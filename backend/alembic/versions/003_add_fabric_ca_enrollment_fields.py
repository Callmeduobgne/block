"""Add Fabric CA enrollment fields to users table

Revision ID: 003_fabric_ca_enrollment
Revises: previous_migration
Create Date: 2025-11-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003_fabric_ca_enrollment'
down_revision = None  # Will be linked automatically
branch_labels = None
depends_on = None


def upgrade():
    # Add Fabric CA enrollment fields to users table
    op.add_column('users', sa.Column('fabric_enrollment_id', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('fabric_enrollment_secret', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('fabric_ca_name', sa.String(length=100), nullable=True, server_default='ca-org1'))
    op.add_column('users', sa.Column('fabric_cert_serial', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('fabric_cert_issued_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('fabric_cert_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('fabric_enrollment_status', sa.String(length=20), nullable=True, server_default='pending'))
    
    # Create indexes
    op.create_index(op.f('ix_users_fabric_enrollment_id'), 'users', ['fabric_enrollment_id'], unique=True)


def downgrade():
    # Drop indexes
    op.drop_index(op.f('ix_users_fabric_enrollment_id'), table_name='users')
    
    # Drop columns
    op.drop_column('users', 'fabric_enrollment_status')
    op.drop_column('users', 'fabric_cert_expires_at')
    op.drop_column('users', 'fabric_cert_issued_at')
    op.drop_column('users', 'fabric_cert_serial')
    op.drop_column('users', 'fabric_ca_name')
    op.drop_column('users', 'fabric_enrollment_secret')
    op.drop_column('users', 'fabric_enrollment_id')

