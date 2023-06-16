require('dotenv').config()
const jwt = require('jsonwebtoken')
const express = require('express');
const cors = require('cors');
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SK);
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
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xlrthmr.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

//verfy jwt---------------------------------------
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
    })
}
//srtipe payment intent api------------------------------
app.post("/create-payment-intent", async (req, res) => {
    const { amount } = req.body;
    if (!amount) {
        return res.send({ errr: true })
    }
    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100,
        currency: "usd",
        payment_method_types: ['card']
    });

    res.send({
        clientSecret: paymentIntent.client_secret,
    });
});



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
        const varifyStudent = async (req, res, next) => {
            const email = req.decoded.email
            const filter = { email: email };
            const user = await database.collection('users').findOne(filter);
            if (user?.role != 'student') {
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
                    role: 'instructor',
                }
            }
            const result = await database.collection('users').updateOne(filter, update);
            res.send(result);
        })

        //get user role--------------------------------------------------
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
        app.get('/users/students/:email', varifyJwt, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            if (req.decoded.email != email)
                return res.send({ student: false });
            const user = await database.collection('users').findOne(filter);
            const result = { student: user?.role === 'student' }
            res.send(result)
        })


        //get all user--------------------------------------------------
        app.get('/users', async (req, res) => {
            const result = await database.collection('users').find().toArray()
            res.send(result)
        })

        app.get('/users/allinstructors', async (req, res) => {
            const filter = { role: 'instructor' }
            const result = await database.collection('users').find(filter).toArray()
            res.send(result)
        })

        //classes apis--------------------------------------
        app.post('/classes', varifyJwt, varifyInstructor, async (req, res) => {
            const newclass = req.body;
            const result = await database.collection('classes').insertOne(newclass);
            res.send(result);
        })
        app.get('/classes/:email', varifyJwt, varifyInstructor, async (req, res) => {
            const filter = { instructor_email: req.params.email }
            const result = await database.collection('classes').find(filter).toArray();
            res.send(result)
        })
        app.get('/classes', async (req, res) => {
            const limit = parseInt(req.query.limit);
            console.log(limit);
            try {
              if (limit) {
                const result = await database.collection('classes').find().sort({ enrolled: -1 }).limit(limit).toArray();
                return res.send(result);
              }
              const result = await database.collection('classes').find().toArray();
              res.send(result);
            } catch (error) {
              res.status(500).json({ error: 'An error occurred' });
            }
          });
          
        app.get('/classes/filter/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await database.collection('classes').findOne(filter);
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
        app.patch('/classes/deny/:id', varifyJwt, varifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const update = {
                $set: {
                    status: 'denied'

                }
            }
            const result = await database.collection('classes').updateOne(filter, update);
            res.send(result);
        })
        app.patch('/classes/feedback/:id', varifyJwt, varifyAdmin, async (req, res) => {
            const id = req.params.id;
            const feedback = req.body.feedback
            const filter = { _id: new ObjectId(id) };
            const update = {
                $set: {
                    feedback: feedback
                }
            }
            const result = await database.collection('classes').updateOne(filter, update);
            res.send(result);
        })

        //Enrolemet apis
        app.post('/classes/selected', varifyJwt, varifyStudent, async (req, res) => {
            const selectedClass = req.body;
            const filter = { class_id: selectedClass.class_id, email: selectedClass.email };

            // Check if a document with the same class_id and email already exists
            const existingClass = await database.collection('selectedClasses').findOne(filter);
            if (existingClass) {
                return res.send({ selected: 1 });
            }

            const result = await database.collection('selectedClasses').insertOne(selectedClass);
            res.send(result);
        });
        app.get('/classes/selected/:email', varifyJwt, varifyStudent, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const result = await database.collection('selectedClasses').find(filter).toArray();
            res.send(result)
        })
        app.get('/classes/selected/filterbyid/:id', varifyJwt, varifyStudent, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await database.collection('selectedClasses').findOne(filter);
            res.send(result)
        })
        //remove from selected add enrolled count and add to enrolled api
        app.delete('/classes/remove-selected/:id', varifyJwt, varifyStudent, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await database.collection('selectedClasses').deleteOne(filter);
            res.send(result)
        })

        app.patch('/classes/add-enrollcount/:id', async (req, res) => {
            const id = req.params.id;
            if (!id) {
                return res.send({ message: 'id not found for add-enrollment' })
            }
            const filter = { _id: new ObjectId(id) }
            const { updatedSeats, updatedEnrolled } = req.body;
            const updatedclass = {
                $set: {
                    seats: updatedSeats,
                    enrolled: updatedEnrolled,
                }
            }
            const result = await database.collection('classes').updateOne(filter, updatedclass);
            res.send(result);
        })
        //add the paid class, selected to enrolled.
        app.post('/classes/enrolled', varifyJwt, varifyStudent, async (req, res) => {
            const paidClass = req.body;
            const result = await database.collection('enrolledClasses').insertOne(paidClass);
            res.send(result)
        })
        app.get('/classes/enrolled/:email', async (req, res) => {
            const { email } = req.params;
            const query = { email: email };
            try {
                const result = await database.collection('enrolledClasses')
                    .find(query)
                    .sort({ paymentDate: -1 })
                    .toArray();
                res.send(result);
            } 
            catch (error) {
                res.status(500).json({ error: 'An error occurred' });
            }
        });


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
