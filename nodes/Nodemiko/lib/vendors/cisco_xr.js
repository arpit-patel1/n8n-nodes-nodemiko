import BaseConnection from '../base_connection.js';

export default class CiscoXR extends BaseConnection {
  constructor(device) {
    super(device);
    // Example prompt: RP/0/RSP0/CPU0:XR-1#
    this.prompt = /(.*[#>$])\s*$/;
    // Example config prompt: RP/0/RSP0/CPU0:XR-1(config)#
    this.config_prompt = /(.*\(config[^\)]*\)#\s*)$/;
    this.commit_error_pattern = /Failed to commit/i;
  }

  async sessionPreparation() {
    await this._delay(500 * this.global_delay_factor);
    this.stream.write('\n');
    await this.readUntilPrompt();
    await this.disablePaging();
  }

  async set_base_prompt() {
    const prompt = await super.set_base_prompt();
    if (prompt) {
      this.base_prompt = prompt.slice(0, 31);
    }
    return this.base_prompt;
  }

  async disablePaging(command = 'terminal length 0') {
    return await super.disablePaging(command);
  }

  checkConfigMode(check_string = ')#') {
    // Strip out (admin) so we don't get a false positive with (admin)#
    const new_base_prompt = this.base_prompt.replace('(admin)', '');
    return new_base_prompt.includes(check_string);
  }

  async commit(commit_command = 'commit', options = {}) {
    const { read_timeout = 120000, confirm = false, confirm_delay = null, comment = '', label = '' } = options;
    if ((confirm && !confirm_delay) || (confirm_delay && !confirm) || (comment && confirm)) {
      throw new Error('Invalid arguments supplied to XR commit');
    }

    const error_marker = 'Failed to';
    const alt_error_marker = 'One or more commits have occurred from other';
    const large_config = 'onfirm';
    const other_changes = 'Do you wish to proceed';
    const pattern = new RegExp(`(?:#|${large_config}|${other_changes})`);

    let cmd = commit_command;
    if (label) {
      if (comment) cmd = `commit label ${label} comment ${comment}`;
      else if (confirm) cmd = `commit label ${label} confirmed ${confirm_delay}`;
      else cmd = `commit label ${label}`;
    } else if (confirm) cmd = `commit confirmed ${confirm_delay}`;
    else if (comment) cmd = `commit comment ${comment}`;

    let output = await this.configMode();

    this.stream.write(`${cmd}\n`);
    let new_data = await this.readUntilPrompt(pattern, read_timeout);
    output += new_data;

    if (new_data.includes(large_config)) {
      this.stream.write('y\n');
      new_data = await this.readUntilPrompt(/#/, read_timeout);
      output += new_data;
    }

    if (output.includes(error_marker)) {
      throw new Error(`Commit failed with the following errors:\n\n${output}`);
    }
    if (output.includes(alt_error_marker)) {
      this.stream.write('no\n');
      output += await this.readUntilPrompt();
      throw new Error(`Commit failed with the following errors:\n\n${output}`);
    }

    return output;
  }

  async exitConfigMode(exit_command = 'end') {
    let output = '';
    if (this.checkConfigMode()) {
      this.stream.write(`${exit_command}\n`);
      const uncommitted_pattern = /(Uncommitted|#$)/;
      output += await this.readUntilPrompt(uncommitted_pattern);

      if (output.includes('Uncommitted')) {
        this.stream.write('no\n');
        output += await this.readUntilPrompt();
      }

      if (this.checkConfigMode()) {
        throw new Error('Failed to exit configuration mode');
      }
    }
    return output;
  }

  async sendConfig(commands) {
    const configCmds = Array.isArray(commands) ? commands : [commands];
    let output = '';

    output += await this.configMode();

    for (const command of configCmds) {
      this.stream.write(`${command}\n`);
      const cmdOutput = await this.readUntilPrompt(this.config_prompt);
      this._checkError(command, cmdOutput);
      output += cmdOutput;
    }

    // Commit the changes
    output += await this.commit();

    // Exit config mode
    output += await this.exitConfigMode();

    return output;
  }
} 