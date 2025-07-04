import { sshDispatcher } from '../ssh_dispatcher.js';

/**
 * A utility function that ensures the connection is closed after the task is complete.
 * It acts like a context manager.
 * @param {object} device - The device object for connection.
 * @param {function} task - The async function to execute with the connection object.
 */
export async function withConnection(device, callback) {
  let conn = null;
  try {
    if (device.debug) {
      console.log(`[Nodemiko] withConnection: Starting connection to ${device.host}`);
    }
    conn = await sshDispatcher(device);
    if (device.debug) {
      console.log(`[Nodemiko] withConnection: Connection established, executing callback`);
    }
    await callback(conn);
    if (device.debug) {
      console.log(`[Nodemiko] withConnection: Callback completed successfully`);
    }
  } catch (error) {
    if (device.debug) {
      console.log(`[Nodemiko] withConnection: Error occurred: ${error.message}`);
    }
    throw error;
  } finally {
    if (conn) {
      if (device.debug) {
        console.log(`[Nodemiko] withConnection: Disconnecting`);
      }
      await conn.disconnect();
    }
  }
} 