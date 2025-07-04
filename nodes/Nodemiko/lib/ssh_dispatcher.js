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
  const { logger } = options;
  if (vendors[device.device_type]) {
    const devWithLogger = { ...device, logger };
    return new vendors[device.device_type](devWithLogger).connect();
  }
  throw new Error(`Unsupported device type: ${device.device_type}`);
}
