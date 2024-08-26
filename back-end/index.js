// create a new express app
const express = require('express');
const app = express();
const port = 3000;
const routers = require('./routers/routers')

Object.keys(routers.MAPPING_ROUTERS).forEach(function(key, idx, arr){
    app.use(key, routers.MAPPING_ROUTERS[key])
});

// make the app listen to port 3000
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    }
);