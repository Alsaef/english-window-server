const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());

app.use(express.json())





const uri = `mongodb+srv://${process.env.DB}:${process.env.password}@cluster0.hwuf8vx.mongodb.net/?appName=Cluster0`;

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
        // await client.connect();

        const DB = client.db('EnglihDB');
        const vocabulary = DB.collection('vocabularys');
        const vocabularys = DB.collection('newListListining');
        const levels = DB.collection('levels');
         const moviesvocab = DB.collection('moviesvocab');


        // app.post('/vocabulary', async (req, res) => {
        //     const dataUpload=req.body;
        //     const result = await moviesvocab.insertMany(dataUpload);
        //     res.send({ status: true, data: result });
        // }) 


         app.get('/movies', async (req, res) => {
         
            const result = await moviesvocab.find().toArray();
            res.send({ status: true, data: result });
        }) 

        app.get('/vocabulary/:level', async (req, res) => {
            const { level } = req.params;
            const query = { level: isNaN(level) ? level : parseInt(level) };
            const result = await vocabulary.find(query).toArray();
            res.send({ status: true, data: result });
        
        })

          app.get('/levels', async (req, res) => {
            const cursor = levels.find();
            const result = await cursor.toArray();
            res.send({status:true,data:result});
        
        })

        app.get('/vocabularydetails/:id', async (req, res) =>{
          

            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await vocabulary.findOne(query);
            res.send({status:true,data:result});

        })



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);






app.get('/', (req, res) => {
    res.send('Hello World!')

})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})