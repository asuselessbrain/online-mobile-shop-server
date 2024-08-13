const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

app.use(
  cors({
    origin: ["http://localhost:5173", "https://astra-gadgets-server.vercel.app"],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  try {
    jwt.verify(token, process.env.Access_Token, (err, decoded) => {
      if (err) {
        res.status(401).send({ message: "Invalid Token" });
      }
      req.user = decoded;
      console.log(req.user);
    });
  } catch (err) {
    console.log(err.message);
  }
  next();
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x6ipdw6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
async function run() {
  try {
    const usersCollection = client.db("astraGadgets").collection("users");
    const phoneCollection = client.db("astraGadgets").collection("phones");
    const cartCollection = client.db("astraGadgets").collection("carts");

    // jwt related api

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.Access_Token, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    // Logout
    app.get("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          maxAge: 0,
          secure: true,
          httpOnly:true,
          sameSite: "none",
        })
        .send({ success: true });
    });

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

    app.put("/update-phone-details/:id", async (req, res) => {
      const product = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          ...product,
        },
      };

      const result = await phoneCollection.updateOne(query, updateDoc);

      res.send(result);
    });

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

    app.delete("/delete-my-added-phone/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await phoneCollection.deleteOne(query);
      res.send(result);
    });

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

    // product add to cart related api
    app.post("/my-cart", async (req, res) => {
      const myCartProduct = req.body;
      const result = await cartCollection.insertOne(myCartProduct);
      res.send(result);
    });

    // get cart item data related api

    app.get("/my-order/:email", async (req, res) => {
      const email = req.params.email;

      const result = await cartCollection
        .aggregate([
          {
            $match: { "userInfo.email": email },
          },
          {
            $addFields: {
              productIdObjectId: { $toObjectId: "$productId" },
            },
          },
          {
            $lookup: {
              from: "phones",
              localField: "productIdObjectId",
              foreignField: "_id",
              as: "productDetails",
            },
          },
          {
            $addFields:{
              orderDetails: {
                $first: "$productDetails"
              }
            }
          },
          {
            $project:{
              productDetails: 0,
              productIdObjectId: 0
            }
          }
        ])
        .toArray();
      res.send(result);
    });

    // delete item from my-cart

    app.delete('/delete-item-from-my-cart/:id', async(req, res) =>{
      const id = req.params.id;

      const query = {_id: new ObjectId(id)}
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })

    // check user role

    app.get("/user-role/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
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
