const fs=require('fs');
async function go(){
  const contractsTS=fs.readFileSync('frontend/src/lib/contracts.ts','utf8');
  const match=contractsTS.match(/googleStockNFT.*"(0x[a-fA-F0-9]{40})"/);
  console.log('Frontend NFT:',match?match[1]:'NOT FOUND');
  console.log('Latest NFT:','0xC83EBFaA17B40B1Ef80B8AF6a332D7053DE37370');
  console.log('Match:',match&&match[1].toLowerCase()==='0xc83ebfaa17b40b1ef80b8af6a332d7053de37370'?'YES':'MISMATCH');
}
go();
