require('dotenv').config()
const jwt = require('jsonwebtoken')
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());
app.use(cors());
app.get('/', (req, res) => {
    res.send(`misiHead server is running part port ${port}`);
})
app.listen(port, () => {
    console.log(`server is running at port ${port}`);
})

//mongo db 
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xlrthmr.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        client.connect();
        const database = client.db('musiHeadDB');
        //jwt api
        app.post('/jwt',(req,res)=>{
           const user = req.body;
           const token = jwt.sign(user,process.env.TOKEN_SCR,{expiresIn:'4h'});
           res.send({token})
        })
        //varify Admin
        const varifyAdmin = async (req,res,next)=>{
            const email = req.decoded.email
            const filter = {email:email};
            const user = await database.collection('users').findOne(filter);
            console.log(email,user);
            if (user?.role !='admin')
            { 
              return res.status(403).send({error:true,message:'forbidden access 2'});
            }
           next()
        }
        const varifyJwt = (req,res,next)=>{
          const authorization = req.headers.authorization
          if(!authorization)
          {
            return res.status(401).send({error:true,message:'unauthorized access'})
          }
          const token = authorization.split(' ')[1]
          jwt.verify(token,process.env.TOKEN_SCR,(error,decoded)=>{
            if(error){
                return res.status(403).send({error:true,message:'forbidden access'})  
            }
            req.decoded=decoded
            next()
            console.log(token);
          })
        }
        //user apis
        app.post('/users',async (req,res)=>{
            const user = req.body;
            const filter = {email:user.email}
            const userexist = await database.collection('users').findOne(filter)
            if(!userexist){
            const result =await database.collection('users').insertOne(user);
            res.send(result)
            }
            else{
                res.status(403).send({error:true,message:'user already exist'})
            }
        })
        //classes apis
        app.post('/classes', varifyJwt, async (req,res)=>{
         const newclass = req.body;
         console.log(newclass);

        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

    }

    finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}
run().catch(console.dir);
