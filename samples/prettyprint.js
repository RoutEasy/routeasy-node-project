require('fs').writeFileSync(process.argv[2], JSON.stringify(require('./' + process.argv[2]), null, 4));
