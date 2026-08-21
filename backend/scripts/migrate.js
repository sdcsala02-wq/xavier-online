const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pool = require("../db");

const migrationsDir = path.join(__dirname, "..", "migrations");
const statusOnly = process.argv.includes("--status");

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function tabelaExiste(client) {
  const { rows } = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'schema_migrations'
    ) AS existe
  `);

  return rows[0].existe;
}

async function main() {
  const client = await pool.connect();

  try {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => /^\d+.*\.sql$/i.test(file))
      .sort();

    const existe = await tabelaExiste(client);

    if (statusOnly) {
      if (!existe) {
        console.log("schema_migrations: AINDA NAO CRIADA");
        console.log(`migrations locais: ${files.length}`);
        return;
      }

      const { rows } = await client.query(`
        SELECT filename, checksum, applied_at
        FROM schema_migrations
        ORDER BY filename
      `);

      console.log("MIGRATIONS APLICADAS:");
      console.table(rows);

      console.log("");
      console.log(`Migrations locais: ${files.length}`);
      console.log(`Migrations aplicadas: ${rows.length}`);
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGSERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: appliedRows } = await client.query(`
      SELECT filename, checksum
      FROM schema_migrations
    `);

    const applied = new Map(
      appliedRows.map((row) => [row.filename, row.checksum])
    );

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, "utf8");
      const checksum = sha256(sql);

      if (applied.has(file)) {
        if (applied.get(file) !== checksum) {
          throw new Error(
            `Migration aplicada foi alterada: ${file}`
          );
        }

        console.log(`OK ja aplicada: ${file}`);
        continue;
      }

      console.log(`Aplicando: ${file}`);

      await client.query("BEGIN");

      try {
        await client.query(sql);

        await client.query(
          `
          INSERT INTO schema_migrations (filename, checksum)
          VALUES ($1, $2)
          `,
          [file, checksum]
        );

        await client.query("COMMIT");

        console.log(`SUCESSO: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("");
    console.log("Migrations concluidas.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("");
  console.error("ERRO:", error.message);
  process.exitCode = 1;
});
