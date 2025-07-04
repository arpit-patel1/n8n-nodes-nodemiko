import CiscoIOS from './vendors/cisco_ios.js';
import CiscoXR from './vendors/cisco_xr.js';
import CiscoNXOS from './vendors/cisco_nxos.js';
import JuniperJunos from './vendors/juniper_junos.js';
import LinuxSSH from './vendors/linux_ssh.js';

const vendors = {
  cisco_ios: CiscoIOS,
  cisco_xr: CiscoXR,
  cisco_nxos: CiscoNXOS,
  juniper_junos: JuniperJunos,
  linux: LinuxSSH,
};

export function sshDispatcher(device, options = {}) {
  console.log(`[Nodemiko Debug] sshDispatcher: Called with device_type: ${device.device_type}`);
  console.log(`[Nodemiko Debug] sshDispatcher: Available vendors: ${Object.keys(vendors)}`);
  console.log(`[Nodemiko Debug] sshDispatcher: Vendor found: ${!!vendors[device.device_type]}`);
  
  if (vendors[device.device_type]) {
    console.log(`[Nodemiko Debug] sshDispatcher: Creating new ${device.device_type} instance`);
    const instance = new vendors[device.device_type](device);
    console.log(`[Nodemiko Debug] sshDispatcher: Instance created, type: ${typeof instance}`);
    console.log(`[Nodemiko Debug] sshDispatcher: Instance constructor: ${instance.constructor.name}`);
    console.log(`[Nodemiko Debug] sshDispatcher: Instance sendCommand exists: ${typeof instance.sendCommand}`);
    console.log(`[Nodemiko Debug] sshDispatcher: Calling connect() method`);
    return instance.connect();
  }
  throw new Error(`Unsupported device type: ${device.device_type}`);
}
