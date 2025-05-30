"""empty message

Revision ID: 352342b84e55
Revises: 
Create Date: 2025-04-24 02:16:50.428477

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '352342b84e55'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('doctor', schema=None) as batch_op:
        batch_op.alter_column('verified_at',
               existing_type=sa.TIMESTAMP(),
               type_=sa.DateTime(),
               existing_nullable=True)

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('doctor', schema=None) as batch_op:
        batch_op.alter_column('verified_at',
               existing_type=sa.DateTime(),
               type_=sa.TIMESTAMP(),
               existing_nullable=True)

    # ### end Alembic commands ###
