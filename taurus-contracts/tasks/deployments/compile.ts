import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names'
import { task } from 'hardhat/config'
import fs from 'fs-extra'
import { HardhatUserConfig } from 'hardhat/types/config'

declare module 'hardhat/types/config' {
    interface HardhatUserConfig {
        multiFileGeneration?: {
            artifactsPaths?: string[];
            typesPaths?: string[];
        }
    }
}

task(TASK_COMPILE, 'Compiles the entire project, building all artifacts')
    .setAction(async (taskArgs, {config}, runSuper) => {
        await runSuper()

        const hardhatUserConfig = config as unknown as HardhatUserConfig
        if (hardhatUserConfig.multiFileGeneration) {
            console.log('Custom Compile Extension: Copy Generated Files to Different Folders')

            if (hardhatUserConfig.multiFileGeneration.artifactsPaths) {
                const artifactsPath = config.paths.artifacts
                for (const path of hardhatUserConfig.multiFileGeneration.artifactsPaths) {
                    await fs.copy(artifactsPath, path)
                }
            }

            if (hardhatUserConfig.multiFileGeneration.typesPaths) {
                const typesPath = config.typechain.outDir
                for (const path of hardhatUserConfig.multiFileGeneration.typesPaths) {
                    await fs.copy(typesPath, path)
                }
            }
        }
    })