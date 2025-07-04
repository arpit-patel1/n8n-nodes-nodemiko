import { sshDispatcher } from '../ssh_dispatcher.js';

/**
 * A utility function that ensures the connection is closed after the task is complete.
 * It acts like a context manager.
 * @param {object} device - The device object for connection.
 * @param {function} task - The async function to execute with the connection object.
 */
export async function withConnection(device, callback) {
  console.log(`[Nodemiko Debug] withConnection: Starting connection to ${device.host}`);
  console.log(`[Nodemiko Debug] withConnection: Device object keys: ${Object.keys(device)}`);
  let conn = null;
  try {
    if (device.debug) {
      console.log(`[Nodemiko] withConnection: Starting connection to ${device.host}`);
    }
    console.log(`[Nodemiko Debug] withConnection: Calling sshDispatcher`);
    conn = await sshDispatcher(device);
    console.log(`[Nodemiko Debug] withConnection: sshDispatcher returned, conn type: ${typeof conn}`);
    console.log(`[Nodemiko Debug] withConnection: conn constructor: ${conn ? conn.constructor.name : 'null'}`);
    if (device.debug) {
      console.log(`[Nodemiko] withConnection: Connection established, executing callback`);
    }
    console.log(`[Nodemiko Debug] withConnection: About to execute callback`);
    await callback(conn);
    console.log(`[Nodemiko Debug] withConnection: Callback execution completed`);
    if (device.debug) {
      console.log(`[Nodemiko] withConnection: Callback completed successfully`);
    }
  } catch (error) {
    console.log(`[Nodemiko Debug] withConnection: Error occurred: ${error.message}`);
    console.log(`[Nodemiko Debug] withConnection: Error stack: ${error.stack}`);
    if (device.debug) {
      console.log(`[Nodemiko] withConnection: Error occurred: ${error.message}`);
    }
    throw error;
  } finally {
    if (conn) {
      console.log(`[Nodemiko Debug] withConnection: Disconnecting`);
      if (device.debug) {
        console.log(`[Nodemiko] withConnection: Disconnecting`);
      }
      await conn.disconnect();
    }
  }
} 