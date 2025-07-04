import { sshDispatcher } from '../ssh_dispatcher.js';

/**
 * A utility function that ensures the connection is closed after the task is complete.
 * It acts like a context manager.
 * @param {object} device - The device object for connection.
 * @param {function} task - The async function to execute with the connection object.
 * @param {object} options - Additional options for the connection.
 */
export async function withConnection(device, callback, options = {}) {
  const { logger } = options;
  let conn = null;
  try {
    conn = await sshDispatcher(device, { logger });
    await callback(conn);
  } finally {
    if (conn) {
      await conn.disconnect();
    }
  }
} 