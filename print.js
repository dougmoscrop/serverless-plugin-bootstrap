 'use strict';

const chalk = require('chalk');
const YAML = require('js-yaml');

const { diff } = require('deep-diff');

 class Printer {

    constructor(serverless) {
      this.serverless = serverless;
    }

    printChanges(stackName, changeSetName, changes) {
      this.serverless.cli.log(`[serverless-plugin-bootstrap] The stack '${stackName}' differs from your local infrastructure code.`);
      this.serverless.cli.log(`[serverless-plugin-bootstrap] Make sure your code is up to date and review the following changes.`);

      const { Parameter, Condition, Resource, Output } = changes.reduce((memo, change) => {
        memo[change.Type] = memo[change.Type] || [];
        memo[change.Type].push(change);
        return memo;
      }, {});

      this.printSection(Parameter, 'Parameter');
      this.printSection(Condition, 'Condition');
      this.printSection(Resource, 'Resource');
      this.printSection(Output, 'Output');

      this.print(chalk.white, '');
      this.serverless.cli.log(`[serverless-plugin-bootstrap] If the above changes look appropriate, you can run 'serverless bootstrap execute --change-set ${changeSetName}'`);
    }

    printSection(values = [], type) {
      if (values.length === 0) {
        return;
      }

      const title = `${chalk.dim('>>')} ${chalk.cyan(type.toUpperCase() + 'S')}`;
      const field = `${type}Change`;
      const label = `${type}Key`;

      this.print(chalk.white, '');
      this.print(chalk.white, title);

      values.forEach(item => {
        const change = item[field];
        const { Action, From, To, References = [] } = change;
        const key = change[label];

        this.print(chalk.white, '');

        switch (Action) {
          case 'Add':
            this.print(chalk.green, `+ ${key}`);
            this.printObj(chalk.green, To, 6);

            if (change.Template) {
              this.print(chalk.dim, '<Template Content>', 6);
              this.printObj(chalk.green, change.Template.To, 8);
            }

            break;
          case 'Remove':
            this.print(chalk.red, `- ${key}`);
            this.printObj(chalk.red, From, 4);
            break;
          case 'Modify':
            this.print(chalk.yellow, `~ ${key}`);

            if (References.length > 0) {
              this.print(chalk.white, 'References changed:', 4);

              References.forEach(reference => {
                const key = Object.keys(reference)[0];
                const value = reference[key];
                this.print(chalk.white, '↪  ' + chalk.yellow(value) + ` (${key})`, 6);
              });
            }

            this.printDiff(From, To, 4);

            if (change.Template) {
              this.print(chalk.dim, '<Template Content>', 6);
              this.printDiff(change.Template.From, change.Template.To, 8);
            }
            break;
          default:
            throw new Error(`Unknown Action: ${Action}`);
        }
      });
    }

    printDiff(From, To, indentation) {
      const differences = diff(From, To);

      if (differences) {
        differences.forEach(({ kind, path = [], lhs, rhs }) => {
          this.print(chalk.white, '');
          this.print(chalk.white, path.join('.'), indentation);

          switch (kind) {
            case 'N':
              this.printObj(chalk.green, rhs, indentation + 2);
              return;
            case 'D':
              this.printObj(chalk.red, lhs, indentation + 2);
              return;
            case 'E':
              this.printObj(chalk.dim, lhs, indentation + 2);
              this.printObj(chalk.magenta, rhs, indentation + 2);
              return;
          }
        });
      }
    }

    printObj(colour, obj, indentation) {
      if (typeof obj === 'object' || Array.isArray(obj)) {
        if (Object.keys(obj).length > 0) {
          const str = YAML.safeDump(obj);
          this.print(colour, str, indentation);
        }
      } else {
        this.print(colour, obj.toString(), indentation);
      }
    }

    print(colour, str, indentation = 1) {
      const indented = str.replace(/^(?!\s*$)/mg, ' '.repeat(indentation));
      this.serverless.cli.consoleLog(colour(indented));
    }
 }

module.exports = (serverless, stackName, changeSetName, changes) => {
  return new Printer(serverless).printChanges(stackName, changeSetName, changes);
};
