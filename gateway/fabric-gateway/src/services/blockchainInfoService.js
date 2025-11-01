const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class BlockchainInfoService {
  async getChannelInfo() {
    try {
      // For now, return hardcoded data from CLI output
      return {
        height: 2,
        currentBlockHash: "JTzrlLI8FhH6ayO3FysmtaxvGViOpoKDyx1A75T+tU0=",
        previousBlockHash: "7N6BZ+U0hWUV8XYKhuYBb5bUpeg6Kn7z/n/F7MTcUR0="
      };
    } catch (error) {
      throw new Error(`Failed to get channel info: ${error.message}`);
    }
  }

  async getBlockInfo(blockNumber) {
    try {
      const channelInfo = await this.getChannelInfo();
      
      if (blockNumber === 0) {
        return {
          blockNumber: 0,
          previousHash: null,
          dataHash: channelInfo.previousBlockHash,
          transactions: []
        };
      } else if (blockNumber === 1) {
        return {
          blockNumber: 1,
          previousHash: channelInfo.previousBlockHash,
          dataHash: channelInfo.currentBlockHash,
          transactions: []
        };
      }
      
      throw new Error(`Block ${blockNumber} not found`);
    } catch (error) {
      throw new Error(`Failed to get block info: ${error.message}`);
    }
  }

  async getLatestBlocks(count = 10) {
    try {
      const channelInfo = await this.getChannelInfo();
      const blocks = [];
      
      for (let i = Math.max(0, channelInfo.height - count); i < channelInfo.height; i++) {
        try {
          const block = await this.getBlockInfo(i);
          blocks.push(block);
        } catch (error) {
          console.warn(`Failed to get block ${i}:`, error.message);
        }
      }
      
      return blocks.reverse(); // Return newest first
    } catch (error) {
      throw new Error(`Failed to get latest blocks: ${error.message}`);
    }
  }
}

module.exports = new BlockchainInfoService();
