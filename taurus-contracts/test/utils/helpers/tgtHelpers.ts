import { getContract } from "./testHelpers";

export const getLatestCheckpointNum = async (userAddress: string) => {
  const tgt = await getContract("TGT");
  const numUserCheckpoints = await tgt.numCheckpoints(userAddress);
  const latestCheckpointNum = numUserCheckpoints === 0 ? 0 : numUserCheckpoints - 1;
  return latestCheckpointNum;
};
