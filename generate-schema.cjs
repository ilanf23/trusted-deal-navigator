const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
if (!supabaseUrl) {
  console.error('Missing VITE_SUPABASE_URL in .env');
  process.exit(1);
}

const projectId = new URL(supabaseUrl).hostname.split('.')[0];

const pool = new Pool({
  host: `db.${projectId}.supabase.co`,
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'postgres',
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

async function getTablesInfo() {
  const query = `
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name;
  `;
  const res = await pool.query(query);
  return res.rows;
}

async function getColumnsInfo(tableName) {
  const query = `
    SELECT
        c.column_name,
        c.data_type,
        (
            SELECT 'Yes'
            FROM information_schema.key_column_usage kcu
            JOIN information_schema.table_constraints tc
              ON kcu.constraint_name = tc.constraint_name
              AND kcu.table_schema = tc.table_schema
            WHERE kcu.table_schema = c.table_schema
              AND kcu.table_name = c.table_name
              AND kcu.column_name = c.column_name
              AND tc.constraint_type = 'PRIMARY KEY'
            LIMIT 1
        ) as is_primary_key,
        c.is_nullable,
        (
            SELECT
                string_agg(DISTINCT ccu.table_name, ', ')
            FROM
                information_schema.key_column_usage kcu
            JOIN information_schema.referential_constraints rc
              ON kcu.constraint_name = rc.constraint_name
              AND kcu.constraint_schema = rc.constraint_schema
            JOIN information_schema.constraint_column_usage ccu
              ON rc.unique_constraint_name = ccu.constraint_name
              AND rc.unique_constraint_schema = ccu.constraint_schema
            WHERE
                kcu.table_schema = c.table_schema
                AND kcu.table_name = c.table_name
                AND kcu.column_name = c.column_name
        ) as foreign_key_to
    FROM
        information_schema.columns c
    WHERE
        c.table_schema = 'public' AND c.table_name = $1
    ORDER BY
        c.ordinal_position;
  `;
  const res = await pool.query(query, [tableName]);
  return res.rows;
}

async function generateSchemaMarkdown() {
  let markdownContent = '# Database Schema\n\n';

  try {
    const tables = await getTablesInfo();
    console.log(`Found ${tables.length} tables in public schema`);

    for (const table of tables) {
      const tableName = table.table_name;
      const columns = await getColumnsInfo(tableName);

      const headers = {
        column_name: 'Column Name',
        data_type: 'Data Type',
        is_primary_key: 'Primary Key',
        is_nullable: 'Nullable',
        foreign_key_to: 'Foreign Key To',
      };
      const headerKeys = Object.keys(headers);

      const maxWidths = {};
      headerKeys.forEach((key) => {
        maxWidths[key] = headers[key].length;
      });

      const processedRows = columns.map((column) => {
        const row = {
          column_name: column.column_name || '-',
          data_type: column.data_type || '-',
          is_primary_key: column.is_primary_key || 'No',
          is_nullable: column.is_nullable === 'YES' ? 'Yes' : 'No',
          foreign_key_to: column.foreign_key_to || '-',
        };

        headerKeys.forEach((key) => {
          if (row[key].length > maxWidths[key]) {
            maxWidths[key] = row[key].length;
          }
        });
        return row;
      });

      markdownContent += `## Table: \`${tableName}\`\n\n`;

      const headerRowParts = headerKeys.map((key) => headers[key].padEnd(maxWidths[key]));
      markdownContent += `| ${headerRowParts.join(' | ')} |\n`;

      const separatorRowParts = headerKeys.map((key) => '-'.repeat(maxWidths[key]));
      markdownContent += `| ${separatorRowParts.join(' | ')} |\n`;

      processedRows.forEach((row) => {
        const dataRowParts = headerKeys.map((key) => row[key].padEnd(maxWidths[key]));
        markdownContent += `| ${dataRowParts.join(' | ')} |\n`;
      });

      markdownContent += `\n`;
    }

    fs.writeFileSync('schema.md', markdownContent, 'utf-8');
    console.log('File schema.md successfully generated!');
  } catch (error) {
    console.error('Error generating schema:', error.message);
  } finally {
    await pool.end();
  }
}

generateSchemaMarkdown();
