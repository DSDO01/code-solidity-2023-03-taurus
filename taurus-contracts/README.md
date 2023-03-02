# Taurus Contracts

## Usage

First, set up .env file with `cp .env.example .env`

Set `HH_USAGE="0"`, set a valid test mnemonic, and set a valid infura API key.

Run `yarn` and then:

- `yarn compile` - to compile smart contracts and generate typechain ts bindings
- `yarn test` - to run tests

Before committing make sure to run the following commands:

- `yarn lint` - This ensures there aren't any lint errors.
- `yarn lint:fix` - If the previous command found any errors, use this command to rectify them.
- `yarn format` - This ensures all the files are formatted according to the standards
- `yarn format:fix` - If the previous command found any errors, use this command to rectify them.

## Slither

Full doc available at https://github.com/crytic/slither

pip install slither-analyzer
apt install graphviz

To generate analysis report, inheritance graph and call graphs run
<code>./scripts/slither.sh</code>
Note: Maybe you will need to add execution grants to script <code>chmod u+x slither.sh</code>

You can visualize graphs with Visual Code, or using online tool https://dreampuf.github.io/GraphvizOnline/ by pasting .dot file content, or use dotX command tool to generate image files from .dot files.

### Analyze

Located at this contracts folder run
<code>slither .</code>

### Call graph

slither --print call-graph

### Inheritance graph

slither .. --print inheritance-graph &> /dev/null

If you want to void 'mixedCase' warnings add this to commands
<code> 2>&1 | fgrep -v 'mixedCase'</code>
