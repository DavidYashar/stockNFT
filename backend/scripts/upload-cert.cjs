require('dotenv').config();
async function go(){
  const {ethers}=require('ethers');
  const w=new ethers.Wallet(process.env.PRIVATE_KEY,new ethers.JsonRpcProvider(process.env.RPC_URL));
  const NFT='0x6096e5a5e0fcA2fE1382c4c6ab54426F6033C9C8';

  const nft=new ethers.Contract(NFT,[
    'function mintPrincipal(uint256) view returns(uint256)',
    'function googlPriceAtMint(uint256) view returns(uint256)',
    'function setIrysTxId(uint256,string)',
    'function uri(uint256) view returns(string)',
  ],w);

  const principal=await nft.mintPrincipal(1);
  const googlPrice=await nft.googlPriceAtMint(1);
  const usdcNum=Number(ethers.formatUnits(principal,6));
  const googlNum=Number(ethers.formatUnits(googlPrice,8));
  const shares=(usdcNum/365).toFixed(6);

  // Generate unique SVG
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="620" viewBox="0 0 800 620">
<defs>
  <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" style="stop-color:#4f7cff"/>
    <stop offset="100%" style="stop-color:#6366f1"/>
  </linearGradient>
  <linearGradient id="bgG" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" style="stop-color:#0a0e27"/>
    <stop offset="100%" style="stop-color:#141832"/>
  </linearGradient>
</defs>
<rect width="800" height="620" fill="url(#bgG)" rx="16"/>
<rect x="16" y="16" width="768" height="588" fill="none" stroke="url(#bg)" stroke-width="4" rx="12"/>
<rect x="28" y="28" width="744" height="564" fill="none" stroke="#4f7cff" stroke-width="1.5" rx="8" opacity="0.5"/>
<rect x="34" y="34" width="732" height="552" fill="none" stroke="#4f7cff" stroke-width="0.5" rx="6" opacity="0.3"/>
<circle cx="50" cy="50" r="6" fill="#4f7cff" opacity="0.6"/>
<circle cx="750" cy="50" r="6" fill="#4f7cff" opacity="0.6"/>
<circle cx="50" cy="570" r="6" fill="#4f7cff" opacity="0.6"/>
<circle cx="750" cy="570" r="6" fill="#4f7cff" opacity="0.6"/>
<text x="400" y="80" text-anchor="middle" font-family="Georgia,serif" font-size="26" font-weight="bold" fill="url(#bg)" letter-spacing="4">IN CHAIN WE TRUST</text>
<text x="400" y="120" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="#e0e0ff" font-weight="600">Google Stock NFT Certificate</text>
<text x="400" y="142" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#8888aa">Tokenized via Ondo Finance · 3.9% APR Yield</text>
<line x1="80" y1="162" x2="720" y2="162" stroke="#4f7cff" stroke-width="1" opacity="0.4"/>
<text x="120" y="210" font-family="Arial,sans-serif" font-size="15" fill="#8888aa">Certificate No</text>
<text x="380" y="210" font-family="Courier New,monospace" font-size="16" fill="#4f7cff" font-weight="bold">#${1}</text>
<text x="120" y="252" font-family="Arial,sans-serif" font-size="15" fill="#8888aa">Owner</text>
<text x="380" y="252" font-family="Courier New,monospace" font-size="13" fill="#e0e0ff">${w.address}</text>
<text x="120" y="294" font-family="Arial,sans-serif" font-size="15" fill="#8888aa">Google Shares (GOOGLon)</text>
<text x="380" y="294" font-family="Courier New,monospace" font-size="16" fill="#4f7cff" font-weight="bold">${shares}</text>
<text x="120" y="336" font-family="Arial,sans-serif" font-size="15" fill="#8888aa">Value (USDC)</text>
<text x="380" y="336" font-family="Courier New,monospace" font-size="16" fill="#4f7cff" font-weight="bold">$${usdcNum}</text>
<text x="120" y="378" font-family="Arial,sans-serif" font-size="15" fill="#8888aa">Issue Date</text>
<text x="380" y="378" font-family="Courier New,monospace" font-size="14" fill="#e0e0ff">${new Date().toISOString().split('T')[0]}</text>
<text x="120" y="420" font-family="Arial,sans-serif" font-size="15" fill="#8888aa">Network</text>
<text x="380" y="420" font-family="Courier New,monospace" font-size="14" fill="#e0e0ff">Ethereum Sepolia</text>
<text x="120" y="462" font-family="Arial,sans-serif" font-size="15" fill="#8888aa">GOOGL Price at Mint</text>
<text x="380" y="462" font-family="Courier New,monospace" font-size="16" fill="#4f7cff" font-weight="bold">$${googlNum.toFixed(2)}</text>
<line x1="80" y1="500" x2="720" y2="500" stroke="#4f7cff" stroke-width="1" opacity="0.4"/>
<text x="400" y="535" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#555577">TOKENIZED VIA ONDO FINANCE · ERC-1155 ON ETHEREUM SEPOLIA</text>
<text x="400" y="555" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" fill="#444466">This certificate represents fractional ownership of Alphabet Class A (GOOGL) stock</text>
</svg>`;

  console.log('SVG size:',svg.length,'chars');

  // Upload SVG to IRYS
  const {Uploader}=await import('@irys/upload');
  const {Ethereum}=await import('@irys/upload-ethereum');
  const irys=await Uploader(Ethereum)
    .withWallet(process.env.PRIVATE_KEY)
    .withRpc(process.env.RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com')
    .devnet();

  console.log('Uploading unique SVG certificate...');
  const certReceipt=await irys.upload(svg,{
    tags:[
      {name:'Content-Type',value:'image/svg+xml'},
      {name:'App-Name',value:'GoogleStockNFT'},
    ]
  });
  console.log('Certificate SVG:',certReceipt.id);
  const imageUrl='https://gateway.irys.xyz/'+certReceipt.id;

  // Upload metadata JSON
  const metadata={
    name:'Google Stock NFT #1',
    description:'On-chain certificate representing fractional ownership of Alphabet Class A (GOOGL) via Ondo Finance GOOGLon',
    image:imageUrl,
    attributes:[
      {trait_type:'Certificate No',value:'1'},
      {trait_type:'Owner',value:w.address},
      {trait_type:'Google Shares (GOOGLon)',value:Number(shares)},
      {trait_type:'Value (USDC)',value:usdcNum},
      {trait_type:'Issue Date',value:new Date().toISOString().split('T')[0]},
      {trait_type:'Network',value:'Ethereum Sepolia'},
      {trait_type:'GOOGL Price at Mint (USD)',value:googlNum},
    ],
  };
  console.log('Uploading metadata...');
  const metaReceipt=await irys.upload(JSON.stringify(metadata),{
    tags:[
      {name:'Content-Type',value:'application/json'},
      {name:'App-Name',value:'GoogleStockNFT'},
    ]
  });
  console.log('Metadata:',metaReceipt.id);

  // Set on-chain
  console.log('Setting on-chain irysTxId...');
  const tx=await nft.setIrysTxId(1,metaReceipt.id,{gasLimit:200000});
  await tx.wait();
  console.log('On-chain updated!');
  console.log('NFT uri(1):',await nft.uri(1));
  console.log('');
  console.log('Image URL:',imageUrl);
  console.log('Open this in browser to see the certificate!');
}
go().catch(e=>console.error('Error:',e.message?.slice(0,300)));
