const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health',(req,res)=>{
    res.send({
  "success": true,
  "message": "Nosh API is running"
})
})

module.exports = app;
