import { Client } from 'ssh2';
import fs from 'fs';

const DEFAULT_PROMPT = /([a-zA-Z0-9.\-@()_:\s]+[#>$%])\s*$/;
const STRIP_ANSI = /[\u001b\u009b][[()#;?]*.{0,2}(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

export default class BaseConnection {
  constructor(device) {
    this.device = device;
    this.client = new Client();
    this.stream = null;
    this.prompt = DEFAULT_PROMPT;
    this.config_prompt = /\(config.*\)#\s*$/;
    this.loggedIn = false;
    this.base_prompt = ''; // The detected prompt string, without regex formatting

    // Timeouts
    this.conn_timeout = device.conn_timeout || 20000; // Default: 20 seconds
    this.read_timeout = device.read_timeout || 10000; // Default: 10 seconds
    this.global_delay_factor = device.global_delay_factor || 1;

    this.config_error_pattern = /(?:Invalid|Incomplete|Ambiguous) command/i;

    // No aliases - using camelCase methods only
  }

  _log(message) {
    // Temporary console logging for debugging
    if (this.device && this.device.debug) {
      console.log(`[Nodemiko Debug] ${message}`);
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  escapeRegExp(string) {
    // Convert to string if it's not already a string to avoid TypeError
    const str = String(string || '');
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }

  _checkError(command, output, errorPattern = null) {
    const pattern = errorPattern ? new RegExp(errorPattern) : this.config_error_pattern;
    if (pattern.test(output)) {
      throw new Error(`Configuration failed: Error while sending command: "${command}"\nOutput: ${output}`);
    }
  }

  connect() {
    console.log(`[Nodemiko Debug] connect() called for host: ${this.device.host}`);
    return new Promise((resolve, reject) => {
      this.client.on('ready', () => {
        console.log(`[Nodemiko Debug] SSH client ready for ${this.device.host}`);
        this._log('SSH client ready.');
        this.client.shell((err, stream) => {
          if (err) {
            console.log(`[Nodemiko Debug] Error getting shell: ${err.message}`);
            return reject(err);
          }
          console.log(`[Nodemiko Debug] Shell established for ${this.device.host}`);
          this.stream = stream;
          this.loggedIn = true;
          this.sessionPreparation()
            .then(() => {
              console.log(`[Nodemiko Debug] Session preparation completed for ${this.device.host}`);
              this.set_base_prompt()
                .then(() => {
                  console.log(`[Nodemiko Debug] Base prompt set for ${this.device.host}, resolving connection`);
                  resolve(this);
                })
                .catch((err) => {
                  console.log(`[Nodemiko Debug] Error setting base prompt: ${err.message}`);
                  reject(err);
                });
            })
            .catch((err) => {
              console.log(`[Nodemiko Debug] Error in session preparation: ${err.message}`);
              reject(err);
            });
        });
      }).on('error', (err) => {
        console.log(`[Nodemiko Debug] SSH client error: ${err.message}`);
        reject(err);
      });

      this._log(`Connecting to ${this.device.host}:${this.device.port || 22}...`);
      const connectParams = {
        host: this.device.host,
        port: this.device.port || 22,
        username: this.device.username,
        readyTimeout: this.conn_timeout,
      };

      if (this.device.use_keys && this.device.key_file) {
        if (!fs.existsSync(this.device.key_file)) {
          return reject(new Error(`Key file not found at path: ${this.device.key_file}`));
        }
        connectParams.privateKey = fs.readFileSync(this.device.key_file);
        if (this.device.passphrase) {
          connectParams.passphrase = this.device.passphrase;
        }
      } else if (this.device.password) {
        connectParams.password = this.device.password;
      } else {
        return reject(new Error('Authentication method required: please provide either a password or SSH key.'));
      }

      this.client.connect(connectParams);
    });
  }

  async disconnect() {
    return new Promise((resolve) => {
      if (!this.loggedIn) {
        resolve();
        return;
      }
      this.client.on('close', () => {
        this.loggedIn = false;
        resolve();
      });
      this.client.end();
    });
  }

  readUntilTimeout(timeout) {
    return new Promise((resolve) => {
      let output = '';
      const dataHandler = (data) => {
        output += data.toString().replace(STRIP_ANSI, '');
      };
      this.stream.on('data', dataHandler);

      setTimeout(() => {
        this.stream.removeListener('data', dataHandler);
        resolve(output);
      }, timeout);
    });
  }

  async readUntilPrompt(promptRegex = this.prompt, timeout = this.read_timeout) {
    console.log(`[Nodemiko Debug] readUntilPrompt called with regex: ${promptRegex}, timeout: ${timeout}ms`);
    this._log(`readUntilPrompt called with regex: ${promptRegex}, timeout: ${timeout}ms`);
    return new Promise((resolve, reject) => {
      let buffer = '';
      const timeoutId = setTimeout(() => {
        this.stream.removeListener('data', onData);
        console.log(`[Nodemiko Debug] Read timeout looking for prompt: ${promptRegex}`);
        console.log(`[Nodemiko Debug] Buffer content at timeout: ${JSON.stringify(buffer)}`);
        this._log(`Read timeout looking for prompt: ${promptRegex}`);
        this._log(`Buffer content at timeout: ${JSON.stringify(buffer)}`);
        reject(new Error(`Read timeout (${timeout}ms) looking for prompt: ${promptRegex}`));
      }, timeout);

      const onData = (data) => {
        const received = data.toString().replace(STRIP_ANSI, '');
        console.log(`[Nodemiko Debug] readUntilPrompt received: ${JSON.stringify(received)}`);
        this._log(`readUntilPrompt received: ${JSON.stringify(received)}`);
        buffer += received;
        console.log(`[Nodemiko Debug] Current buffer: ${JSON.stringify(buffer)}`);
        this._log(`Current buffer: ${JSON.stringify(buffer)}`);
        const match = buffer.match(promptRegex);
        console.log(`[Nodemiko Debug] Regex match result: ${match ? JSON.stringify(match) : 'no match'}`);
        this._log(`Regex match result: ${match ? JSON.stringify(match) : 'no match'}`);
        if (match) {
          this.base_prompt = match[0].trim();
          console.log(`[Nodemiko Debug] Updated base_prompt to: ${this.base_prompt}`);
          this._log(`Updated base_prompt to: ${this.base_prompt}`);
          clearTimeout(timeoutId);
          this.stream.removeListener('data', onData);
          console.log(`[Nodemiko Debug] Resolving with buffer: ${JSON.stringify(buffer)}`);
          resolve(buffer);
        }
      };

      this.stream.on('data', onData);
    });
  }

  async findPrompt() {
    console.log(`[Nodemiko Debug] findPrompt() called`);
    console.log(`[Nodemiko Debug] findPrompt: Current base_prompt: ${JSON.stringify(this.base_prompt)}`);
    
    // If we already have a valid base_prompt, don't try to find a new one
    if (this.base_prompt && this.base_prompt.length > 1) {
      console.log(`[Nodemiko Debug] findPrompt: Already have valid base_prompt, returning existing: ${this.base_prompt}`);
      return Promise.resolve(this.base_prompt);
    }
    
    return new Promise((resolve, reject) => {
      if (!this.stream) {
        console.log(`[Nodemiko Debug] findPrompt: No stream available`);
        return reject(new Error('Connection not established'));
      }
      console.log(`[Nodemiko Debug] findPrompt: Writing newline to stream`);
      this.stream.write('\n', async (err) => {
        if (err) {
          console.log(`[Nodemiko Debug] findPrompt: Error writing newline: ${err.message}`);
          return reject(err);
        }
        try {
          console.log(`[Nodemiko Debug] findPrompt: Waiting for delay`);
          await this._delay(300 * this.global_delay_factor);
          console.log(`[Nodemiko Debug] findPrompt: Reading until timeout`);
          const output = await this.readUntilTimeout(1500);
          console.log(`[Nodemiko Debug] findPrompt: Read output: ${JSON.stringify(output)}`);
          const lines = output.trim().split('\n');
          const new_prompt = lines[lines.length - 1].trim();
          console.log(`[Nodemiko Debug] findPrompt: Extracted prompt: ${JSON.stringify(new_prompt)}`);
          if (new_prompt && new_prompt.length > 1) {
            this.base_prompt = new_prompt;
            this.prompt = new RegExp(this.escapeRegExp(this.base_prompt) + '\\s*$');
            console.log(`[Nodemiko Debug] findPrompt: Set base_prompt to: ${this.base_prompt}`);
            console.log(`[Nodemiko Debug] findPrompt: Set prompt regex to: ${this.prompt}`);
            resolve(this.base_prompt);
          } else {
            // Fallback to a generic prompt if detection fails
            console.log(`[Nodemiko Debug] findPrompt: Using default prompt as fallback`);
            this.prompt = DEFAULT_PROMPT;
            resolve('');
          }
        } catch (e) {
          // Fallback to a generic prompt on error
          console.log(`[Nodemiko Debug] findPrompt: Error occurred: ${e.message}, using default prompt`);
          this.prompt = DEFAULT_PROMPT;
          resolve('');
        }
      });
    });
  }

  async set_base_prompt() {
    try {
      const prompt = await this.findPrompt();
      this.prompt = new RegExp(this.escapeRegExp(prompt) + '\\s*$');
      this.base_prompt = prompt;
    } catch (e) {
      this._log(`Failed to find prompt: ${e.message}. Falling back to default prompt.`);
      this.prompt = DEFAULT_PROMPT;
      this.base_prompt = '';
    }
    return this.base_prompt;
  }

  async sessionPreparation() {
    // This method is intended to be overridden by subclasses for initial setup
    // like disabling paging. The base implementation does nothing.
    return Promise.resolve();
  }

  checkEnableMode() {
    // Privileged EXEC mode on most devices includes a '#'
    return this.base_prompt.includes('#');
  }

  async sendCommand(command, options = {}) {
    console.log(`[Nodemiko Debug] *** ENTERING sendCommand ***`);
    console.log(`[Nodemiko Debug] sendCommand: this object type: ${typeof this}`);
    console.log(`[Nodemiko Debug] sendCommand: this constructor: ${this.constructor.name}`);
    console.log(`[Nodemiko Debug] sendCommand: command parameter: ${JSON.stringify(command)}`);
    console.log(`[Nodemiko Debug] sendCommand: options parameter: ${JSON.stringify(options)}`);
    
    const {
      expectString: expect_string = null,
      stripPrompt: strip_prompt = true,
      stripCommand: strip_command = true,
      delayFactor: delay_factor = 1,
    } = options;

    console.log(`[Nodemiko Debug] sendCommand: Destructured options`);
    console.log(`[Nodemiko Debug] sendCommand: expect_string: ${expect_string}`);
    console.log(`[Nodemiko Debug] sendCommand: strip_prompt: ${strip_prompt}`);
    console.log(`[Nodemiko Debug] sendCommand: strip_command: ${strip_command}`);
    console.log(`[Nodemiko Debug] sendCommand: delay_factor: ${delay_factor}`);

    // Force debug logging to console to see what's happening
    console.log(`[Nodemiko Debug] sendCommand called with: ${command}`);
    console.log(`[Nodemiko Debug] Device debug flag: ${this.device ? this.device.debug : 'undefined'}`);
    console.log(`[Nodemiko Debug] Current prompt regex: ${this.prompt}`);
    console.log(`[Nodemiko Debug] Current base_prompt: ${this.base_prompt}`);
    console.log(`[Nodemiko Debug] Stream exists: ${!!this.stream}`);
    console.log(`[Nodemiko Debug] Logged in: ${this.loggedIn}`);
    
    this._log(`Sending command: ${command}`);
    this._log(`Command options: ${JSON.stringify(options)}`);
    this._log(`Current prompt regex: ${this.prompt}`);
    this._log(`Current base_prompt: ${this.base_prompt}`);
    
    console.log(`[Nodemiko Debug] sendCommand: Creating Promise`);
    return new Promise((resolve, reject) => {
      console.log(`[Nodemiko Debug] sendCommand: Inside Promise executor`);
      if (!this.stream) {
        console.log(`[Nodemiko Debug] sendCommand: No stream available, rejecting`);
        return reject(new Error('Connection not established'));
      }
      console.log(`[Nodemiko Debug] sendCommand: Stream available, writing command`);
      this.stream.write(`${command}\n`, async (err) => {
        console.log(`[Nodemiko Debug] sendCommand: Write callback called`);
        if (err) {
          console.log(`[Nodemiko Debug] sendCommand: Write error: ${err.message}`);
          return reject(err);
        }
        console.log(`[Nodemiko Debug] sendCommand: Command written successfully, waiting for delay`);
        await this._delay(50 * this.global_delay_factor);
        console.log(`[Nodemiko Debug] sendCommand: Delay completed, starting try block`);
        try {
          const promptRegex = expect_string ? new RegExp(expect_string) : this.prompt;
          const command_timeout = this.read_timeout * delay_factor;
          console.log(`[Nodemiko Debug] sendCommand: Prompt regex: ${promptRegex}`);
          console.log(`[Nodemiko Debug] sendCommand: Command timeout: ${command_timeout}ms`);
          this._log(`Using prompt regex: ${promptRegex} with timeout: ${command_timeout}ms`);
          
          let output = await this.readUntilPrompt(promptRegex, command_timeout);
          console.log(`[Nodemiko Debug] Raw output received: ${JSON.stringify(output)}`);
          this._log(`Raw output received: ${JSON.stringify(output)}`);

          if (strip_command) {
            const commandRegex = new RegExp(`^${command}\\s*\\r?\\n`);
            console.log(`[Nodemiko Debug] Stripping command with regex: ${commandRegex}`);
            this._log(`Stripping command with regex: ${commandRegex}`);
            output = output.replace(commandRegex, '');
            console.log(`[Nodemiko Debug] After stripping command: ${JSON.stringify(output)}`);
            this._log(`After stripping command: ${JSON.stringify(output)}`);
          }
          if (strip_prompt) {
            console.log(`[Nodemiko Debug] Stripping prompt with regex: ${promptRegex}`);
            this._log(`Stripping prompt with regex: ${promptRegex}`);
            output = output.replace(promptRegex, '');
            console.log(`[Nodemiko Debug] After stripping prompt: ${JSON.stringify(output)}`);
            this._log(`After stripping prompt: ${JSON.stringify(output)}`);
          }

          console.log(`[Nodemiko Debug] Final output: ${JSON.stringify(output.trim())}`);
          this._log(`Final output: ${JSON.stringify(output.trim())}`);
          console.log(`[Nodemiko Debug] sendCommand: About to resolve with output`);
          resolve(output.trim());
        } catch (e) {
          console.log(`[Nodemiko Debug] sendCommand: Caught error in try block: ${e.message}`);
          console.log(`[Nodemiko Debug] sendCommand: Error stack: ${e.stack}`);
          this._log(`Error in sendCommand: ${e.message}`);
          reject(e);
        }
      });
    });
  }

  async enable() {
    // This method is a placeholder for entering enable mode.
    if (this.checkEnableMode()) {
      return '';
    }
    if (!this.device.secret) {
      return 'No secret provided. Cannot enter enable mode.';
    }

    return new Promise((resolve, reject) => {
      this.stream.write('enable\n', async (err) => {
        if (err) return reject(err);
        try {
          let output = await this.readUntilPrompt(/Password:/i);
          this.stream.write(`${this.device.secret}\n`, async (writeErr) => {
            if (writeErr) return reject(writeErr);
            
            await this.findPrompt();
            const remainingOutput = await this.readUntilPrompt();
            output += remainingOutput;

            if (this.checkEnableMode()) {
              resolve(output);
            } else {
                reject(new Error('Failed to enter enable mode. Please check the secret.'));
            }
          });
        } catch (e) {
          reject(new Error(`Failed to enter enable mode: ${e.message}`));
        }
      });
    });
  }

  checkConfigMode() {
    return this.config_prompt.test(this.base_prompt);
  }

  async configMode(config_command = 'configure terminal', options = {}) {
    const { expectString = null } = options;
    const promptRegex = expectString ? new RegExp(expectString) : this.config_prompt;
    let output = '';

    if (!this.checkConfigMode()) {
      this.stream.write(`${config_command}\n`);
      output = await this.readUntilPrompt(promptRegex);
      if (!this.checkConfigMode()) {
        throw new Error('Failed to enter configuration mode.');
      }
    }
    return output;
  }

  async exitConfigMode(exit_command = 'end', options = {}) {
    const { expectString = null } = options;
    const promptRegex = expectString ? new RegExp(expectString) : this.prompt;
    let output = '';

    if (this.checkConfigMode()) {
      this.stream.write(`${exit_command}\n`);
      output = await this.readUntilPrompt(promptRegex);
      if (this.checkConfigMode()) {
        throw new Error('Failed to exit configuration mode.');
      }
    }
    return output;
  }

  async commit() {
    // Placeholder for devices that require a commit (like Juniper)
    // This should be overridden in the specific vendor class
    return Promise.resolve('');
  }

  async exitEnableMode(exit_command = 'disable', options = {}) {
    let output = '';
    if (this.checkEnableMode()) {
      const cmd_options = {
        ...options,
        expectString: this.prompt.source,
      };
      output = await this.sendCommand(exit_command, cmd_options);
      if (this.checkEnableMode()) {
        throw new Error('Failed to exit enable mode.');
      }
    }
    return output;
  }

  async sendConfig(commands, options = {}) {
    const {
      errorPattern = null,
      configModeCommand = 'configure terminal',
      enterConfigMode = true,
      exitConfigMode = true,
    } = options;

    if (!Array.isArray(commands)) {
      commands = [commands];
    }

    let entered_enable = false;
    if (this.device.secret && !this.checkEnableMode()) {
      await this.enable();
      entered_enable = true;
    }

    if (enterConfigMode) {
      await this.configMode(configModeCommand, options);
    }

    let full_output = '';
    for (const cmd of commands) {
      const cmd_options = {
        ...options,
        expectString: this.config_prompt.source,
        strip_prompt: false,
        strip_command: false,
      };
      const output = await this.sendCommand(cmd, cmd_options);
      this._checkError(cmd, output, errorPattern);
      full_output += output;
    }

    if (exitConfigMode) {
      await this.exitConfigMode('end', options);
    }

    if (entered_enable) {
      await this.exitEnableMode('disable', options);
    }

    return full_output;
  }

  async fileTransfer(source_file, dest_file, direction = 'put') {
    return new Promise((resolve, reject) => {
      this.client.sftp((sftpErr, sftp) => {
        if (sftpErr) {
          return reject(new Error(`SFTP session error: ${sftpErr.message}`));
        }

        const sftpError = (err) => {
          sftp.end();
          reject(new Error(`SFTP operation failed: ${err.message}`));
        };

        if (direction === 'put') {
          if (!fs.existsSync(source_file)) {
            return reject(new Error(`Source file not found: ${source_file}`));
          }
          const readStream = fs.createReadStream(source_file);
          const writeStream = sftp.createWriteStream(dest_file);
          writeStream.on('close', () => {
            sftp.end();
            resolve(`File ${source_file} uploaded to ${dest_file}`);
          }).on('error', sftpError);
          readStream.pipe(writeStream);
        } else if (direction === 'get') {
          const readStream = sftp.createReadStream(source_file);
          const writeStream = fs.createWriteStream(dest_file);
           writeStream.on('close', () => {
             sftp.end();
             resolve(`File ${source_file} downloaded to ${dest_file}`);
           }).on('error', sftpError);
          readStream.on('error', sftpError).pipe(writeStream);
        } else {
          sftp.end();
          reject(new Error('Invalid direction. Must be "put" or "get".'));
        }
      });
    });
  }

  async disablePaging(command = 'terminal length 0') {
    // Overridden by subclasses.
    try {
      return await this.sendCommand(command);
    } catch (err) {
      // Ignore errors from devices that don't support this command.
    }
  }
}
