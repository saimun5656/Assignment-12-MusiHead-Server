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
const { MongoClient, ServerApiVersion, ObjectId} = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xlrthmr.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
const varifyJwt = (req, res, next) => {
    const authorization = req.headers.authorization
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.TOKEN_SCR, (error, decoded) => {
        if (error) {
            return res.status(403).send({ error: true, message: 'forbidden access' })
        }
        req.decoded = decoded
        next()
        console.log(token);
    })
}
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        client.connect();
        const database = client.db('musiHeadDB');
        //jwt api
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.TOKEN_SCR, { expiresIn: '4h' });
            res.send({ token })
        })
        //varify Admin and Instructor
        const varifyAdmin = async (req, res, next) => {
            const email = req.decoded.email
            const filter = { email: email };
            const user = await database.collection('users').findOne(filter);
            if (user?.role != 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access 2' });
            }
            next()
        }
        const varifyInstructor = async (req, res, next) => {
            const email = req.decoded.email
            const filter = { email: email };
            const user = await database.collection('users').findOne(filter);
            if (user?.role != 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden access 2' });
            }
            next()
        }

        //user apis---------------------------------------------------------------
        app.post('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email }
            const userexist = await database.collection('users').findOne(filter)
            if (!userexist) {
                const result = await database.collection('users').insertOne(user);
                res.send(result)
            }
            else {
                res.status(403).send({ error: true, message: 'user already exist' })
            }
        })
        app.patch('/users/admin/:id', varifyJwt, varifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const update = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await database.collection('users').updateOne(filter, update);
            res.send(result);
        })
        app.patch('/users/instructors/:id', varifyJwt, varifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const update = {
                $set: {
                    role: 'instructor'
                }
            }
            const result = await database.collection('users').updateOne(filter, update);
            res.send(result);
        })
        app.get('/users/admin/:email', varifyJwt, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            if (req.decoded.email != email)
                return res.send({ admin: false });
            const user = await database.collection('users').findOne(filter);
            const result = { admin: user?.role === 'admin' }
            res.send(result)
        })
        app.get('/users/instructors/:email', varifyJwt, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            if (req.decoded.email != email)
                return res.send({ instructor: false });
            const user = await database.collection('users').findOne(filter);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result)
        })
        
        app.get('/users', async (req,res)=>{
            const result = await database.collection('users').find().toArray()
            res.send(result)
        })

        //classes apis--------------------------------------
        app.post('/classes', varifyJwt, varifyInstructor, async (req, res) => {
            const newclass = req.body;
            const result = await database.collection('classes').insertOne(newclass);
            res.send(result);
        })
       app.get ('/classes/:email', varifyJwt, varifyInstructor, async(req,res)=>{
        const filter ={instructor_email : req.params.email}
        const result = await database.collection('classes').find(filter).toArray();
        res.send(result)
       })
       app.get('/classes', async(req,res)=>{
        const result = await database.collection('classes').find().toArray();
        res.send(result)
       })
       app.patch('/classes/approve/:id', varifyJwt, varifyAdmin, async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const update = {
            $set: {
                status: 'approved'

            }
        }
        const result = await database.collection('classes').updateOne(filter, update);
        res.send(result);
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
