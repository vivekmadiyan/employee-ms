import { randomUUID } from 'node:crypto';
import { pool, query } from './db.js';

const ownership = 'company_id=$1 AND user_id=$2 AND owner_role=$3';
const recent = "updated_at > NOW() - INTERVAL '30 days'";
const ownerParams = user => [user.companyId, user.id, user.role];
const listFields = 'id, title, updated_at AS "updatedAt"';
const conversationLimit = 20;
const turnLimit = 12;

export async function listAiConversations(user) {
  const result = await query(
    `SELECT ${listFields} FROM ai_conversations WHERE ${ownership} AND ${recent} ORDER BY updated_at DESC, id DESC LIMIT $4`,
    [...ownerParams(user), conversationLimit]
  );
  return result.rows;
}

export async function readAiConversation(user, id) {
  const result = await query(`SELECT ${listFields}, turns FROM ai_conversations WHERE ${ownership} AND id=$4 AND ${recent}`, [...ownerParams(user), id]);
  return result.rows[0];
}

export async function deleteAiConversation(user, id) {
  const result = await query(`DELETE FROM ai_conversations WHERE ${ownership} AND id=$4`, [...ownerParams(user), id]);
  return result.rowCount > 0;
}

export async function saveAiTurn(user, id, question, reply) {
  const { action, handoffDraft, ...transcript } = reply;
  if (handoffDraft) transcript.answer += '\n\nOpen the source task to prepare a new follow-up.';
  if (action) transcript.answer = 'A task change was proposed. Ask for a new draft to review it again.';
  const turns = JSON.stringify([{ question, ...transcript }]);
  const owner = ownerParams(user);

  if (id) {
    const result = await query(
      `UPDATE ai_conversations SET turns=(
         SELECT jsonb_agg(value ORDER BY position)
         FROM jsonb_array_elements(turns || $5::jsonb) WITH ORDINALITY AS turn(value, position)
         WHERE position > jsonb_array_length(turns || $5::jsonb) - $6::int
       ), updated_at=clock_timestamp() WHERE ${ownership} AND id=$4 AND ${recent} RETURNING id`,
      [...owner, id, turns, turnLimit]
    );
    return result.rows[0]?.id;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::int, $2::int)', owner.slice(0, 2));
    const title = Array.from(question.replace(/\s+/g, ' ')).slice(0, 80).join('');
    const newId = randomUUID();
    await client.query(
      `INSERT INTO ai_conversations(company_id, user_id, owner_role, id, title, turns, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, clock_timestamp())`,
      [...owner, newId, title, turns]
    );
    await client.query(
      `DELETE FROM ai_conversations WHERE ${ownership} AND id IN (
         SELECT id FROM ai_conversations WHERE ${ownership} ORDER BY updated_at DESC, id DESC OFFSET $4
       )`,
      [...owner, conversationLimit]
    );
    await client.query('COMMIT');
    return newId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export const purgeExpiredAiConversations = () => query(`DELETE FROM ai_conversations WHERE NOT (${recent})`);
