const ethers = require("ethers");
const { DefenderRelaySigner, DefenderRelayProvider } = require("defender-relay-client/lib/ethers");
// Get the abis
const filterAccsAbi = [];
const liqBotAbi = [];
const baseVaultAbi = [];
const filterAccsAddr = "";
const liqBotAddr = "";
const baseVaultAddr = "";

exports.handler = async function (credentials) {
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, { speed: "safeLow" });

  let filterAccsContract = new ethers.Contract(filterAccsAddr, filterAccsAbi, signer);
  let liqBotContract = new ethers.Contract(liqBotAddr, liqBotAbi, signer);
  let baseVaultContract = new ethers.Contract(baseVaultAddr, baseVaultAbi, signer);
  let accDetails = await filterAccsContract.fetchUnhealhyAccounts();

  if (accDetails.length > 0) {
    for (let i = 0; i < accDetails.length; i++) {
      const accHealthy = await baseVaultContract.getAccountHealth(accDetails[i]);
      if (!accHealthy) {
        const liqAmt = await baseVaultContract.checkLiquidity(accDetails[i]);
        await liqBotContract.liquidate({
          vaultAddress: vaultAddress,
          accountAddr: accDetails[i],
          amount: liqAmt,
          offset: true,
        });
      }
    }
  }
};
