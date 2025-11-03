#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE gateway_db;
    GRANT ALL PRIVILEGES ON DATABASE gateway_db TO $POSTGRES_USER;
EOSQL

echo "Database gateway_db created successfully"
