const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.Stripe_Secrete_Key);
const cookieParser = require("cookie-parser");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://astra-gadgets.netlify.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x6ipdw6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
async function run() {
  try {
    const usersCollection = client.db("astraGadgets").collection("users");
    const phoneCollection = client.db("astraGadgets").collection("phones");
    const cartCollection = client.db("astraGadgets").collection("carts");
    const paymentCollection = client.db("astraGadgets").collection("payments");

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
          req.decoded = decoded;
        });
      } catch (err) {
        console.log(err.message);
      }
      next();
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;

      const query = { email: email };

      const user = await usersCollection.findOne(query);

      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden ACCESS" });
      }

      next();
    };

    // jwt related api

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.Access_Token, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Logout
    app.get("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          maxAge: 0,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
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

    app.get("/phone-details/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await phoneCollection.findOne(query);
      res.send(result);
    });

    // post phone details in database

    app.post("/upload-phone-details", verifyToken, async (req, res) => {
      const phoneDetails = req.body;
      const result = await phoneCollection.insertOne(phoneDetails);
      res.send(result);
    });

    // update phone details in database

    app.put("/update-phone-details/:id", verifyToken, async (req, res) => {
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

    app.get("/my-added-phone/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "hostInfo.host_email": email };
      const result = await phoneCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    // delete my added phone related api

    app.delete("/delete-my-added-phone/:id", verifyToken, async (req, res) => {
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
    app.post("/my-cart", verifyToken, async (req, res) => {
      const myCartProduct = req.body;
      const result = await cartCollection.insertOne(myCartProduct);
      res.send(result);
    });

    // verify product is stored in database or not

    app.get("/my-cart/:email/:id", verifyToken, async (req, res) => {
      const email = req.params.email;
      const id = req.params.id;

      const query = { "userInfo.email": email, productId: id };

      const result = await cartCollection.findOne(query);
      res.send(result);
    });

    // update existing product quantity

    app.put("/my-cart/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { quantity } = req.body;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          quantity: quantity,
        },
      };

      const result = await cartCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get cart item data related api

    app.get("/my-order", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;

        const result = await cartCollection
          .aggregate([
            {
              $match: { "userInfo.email": email },
            },
            {
              $addFields: {
                productIdObjectId: { $toObjectId: "$productId" }, // Ensure your MongoDB version supports $toObjectId
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
              $addFields: {
                orderDetails: {
                  $first: "$productDetails",
                },
              },
            },
            {
              $project: {
                productDetails: 0,
                productIdObjectId: 0,
              },
            },
          ])
          .toArray();

        res.send(result);
      } catch (error) {
        console.error("Error fetching order details:", error);
        res
          .status(500)
          .send({ message: "An error occurred while fetching order details." });
      }
    });

    app.get("/my-order-count", async (req, res) => {
      const email = req.query.email;

      const filter = { "userInfo.email": email };

      const result = await cartCollection.find(filter).toArray();
      res.send(result);
    });

    // delete item from my-cart

    app.delete(
      "/delete-item-from-my-cart/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };
        const result = await cartCollection.deleteOne(query);
        res.send(result);
      }
    );

    // payment related api

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      const orderAmount = parseInt(price * 0.00837 * 100);

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: orderAmount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
        // [DEV]: For demo purposes only, you should avoid exposing the PaymentIntent ID in the client-side code.
        dpmCheckerLink: `https://dashboard.stripe.com/settings/payment_methods/review?transaction_id=${paymentIntent.id}`,
      });
    });

    // get data for admin dashboard stats

    app.get("/admin-stats", async(req, res) =>{
      const totalUser = await usersCollection.estimatedDocumentCount()
      const totalProduct = await phoneCollection.estimatedDocumentCount()
      const totalOrder = await paymentCollection.estimatedDocumentCount()
      const revenueResult = await paymentCollection.aggregate([
        {
          $group:{
            _id: null,
            totalRevenue: {$sum: "$price"}
          }
        },
        {
          $project: {
            _id: 0,
            totalRevenue: 1
          }
        }
      ]).toArray()

      const revenue = revenueResult.length > 0? revenueResult[0].totalRevenue : 0

      res.send({totalUser,totalProduct, totalOrder, revenue})
    })

    // save info after payment in database

    app.post("/payments", async (req, res) => {
      const product = req.body;
      console.log(product)

      const postResult = await paymentCollection.insertOne(product);

      const query = {
        _id: {
          $in: product.cartIds.map((id) => new ObjectId(id)),
        },
      };

      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ postResult, deleteResult });
    });

    // check user role

    app.get("/user-role/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // get all users data

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // update user role
    app.patch(
      "/users/role/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const userRole = req.body;
        const query = { email: email };
        const updateDoc = {
          $set: {
            ...userRole,
          },
        };
        const result = await usersCollection.updateOne(query, updateDoc);
        res.send(result);
      }
    );
    // delete user from database

    app.delete("/delete-user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne();
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
