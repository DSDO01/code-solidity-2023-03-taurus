import { TASK_CLEAN } from 'hardhat/builtin-tasks/task-names'
import { task } from 'hardhat/config'
import fs from 'fs-extra'
import { HardhatUserConfig } from 'hardhat/types/config'

task(TASK_CLEAN, 'Clears the cache and deletes all artifacts')
    .setAction(async (taskArgs, {config}, runSuper) => {
        await runSuper()

        const hardhatUserConfig = config as unknown as HardhatUserConfig
        if (hardhatUserConfig.multiFileGeneration) {
            console.log('Custom Clean Extension: Remove Generated Files in Different Folders')

            if (hardhatUserConfig.multiFileGeneration.artifactsPaths) {
                for (const path of hardhatUserConfig.multiFileGeneration.artifactsPaths) {
                    await fs.remove(path)
                }
            }

            if (hardhatUserConfig.multiFileGeneration.typesPaths) {
                for (const path of hardhatUserConfig.multiFileGeneration.typesPaths) {
                    await fs.remove(path)
                }
            }
        }
    })