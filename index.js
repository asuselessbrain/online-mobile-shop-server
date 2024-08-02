const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x6ipdw6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x6ipdw6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
// const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
async function run() {
  try {
    const usersCollection = client.db("astraGadgets").collection("users");
    const phoneCollection = client.db("astraGadgets").collection("phones");
    // Query for a movie that has the title 'Back to the Future'

    // get latest phone
    app.get("/latest-phones", async (req, res) => {
      const result = await phoneCollection
        .find()
        .sort({ _id: -1 })
        .limit(8)
        .toArray();
      res.send(result);
    });

    app.get("/all-phones", async (req, res) => {
      const brand = req.query.brand;
      let query = {};
      if (brand && brand !== "null") query = { brand };
      const result = await phoneCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    // get phone details

    app.get("/phone-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await phoneCollection.findOne(query);
      res.send(result);
    });

    // post phone details in database

    app.post("/upload-phone-details", async (req, res) => {
      const phoneDetails = req.body;
      const result = await phoneCollection.insertOne(phoneDetails);
      res.send(result);
    });

    // update phone details in database

    app.put("/update-phone-details/:id", async(req,res)=>{
      const product = req.body
      const id = req.params.id
      const query = {_id: new ObjectId(id)}

      const updateDoc = {
        $set: {
          ...product
        },
      };

      const result = await phoneCollection.updateOne(query, updateDoc)

      res.send(result)
    })

    // display my added phone related api

    app.get("/my-added-phone/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "hostInfo.host_email": email };
      const result = await phoneCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    // delete my added phone related api

    app.delete("/delete-my-added-phone/:id", async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await phoneCollection.deleteOne(query)
      res.send(result)
    })

    // set user in database
    app.post("/users", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "User is exist", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
