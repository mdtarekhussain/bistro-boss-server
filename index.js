const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 5000;
// middleware
app.use(cors());
// { origin: "http://localhost:5173/", Credential: true }
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DV_USER}:${process.env.DV_PASSWORD}@cluster0.vcokv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const userCollection = client.db("bistroDb").collection("users");
const menuCollection = client.db("bistroDb").collection("menu");
const reviewsCollection = client.db("bistroDb").collection("reviews");
const cardCollection = client.db("bistroDb").collection("card");
const paymentCollection = client.db("bistroDb").collection("payments");
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // middlewares
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      // if (!req.decoded || !req.decoded.email) {
      //   return res.status(403).send({ message: "Unauthorized Access" });
      // }
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";

      if (!isAdmin) {
        return res.status(403).send({ message: "Access Denied" });
      }
      next();
    };

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1d",
      });
      res.send({ token });
    });
    // user collection
    app.post("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "you already exist", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.get("/user", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get(
      "/user/admin/:email",
      verifyToken,

      async (req, res) => {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: "unauthorize" });
        }
        const query = { email: email };
        const user = await userCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === "admin";
        }
        res.send({ admin });
      }
    );
    app.delete("/user/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    app.patch("/user/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // Menu collection
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    app.post("/menu", async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });
    app.delete("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });
    app.patch("/menu/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          image: item.image,
          recipe: item.recipe,
        },
      };
      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });
    // reviews collection
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    // Card collection
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cardCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/cards", async (req, res) => {
      const cartId = req.body;
      const result = await cardCollection.insertOne(cartId);
      res.send(result);
    });
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cardCollection.deleteOne(query);
      res.send(result);
    });
    // payment
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      if (amount < 1000) {
        return res
          .status(400)
          .send({ error: "Amount is too low to process payment." });
      }
      console.log(amount, "taka taka");
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    // app.post("/payments", async (req, res) => {
    //   const payment = req.body;
    //   const paymentInfo = await paymentCollection.insertOne(payment);
    //   console.log("payment Info", payment);
    //   const query = {
    //     _id: {
    //       $in: payment.cartIds.map((id) => new ObjectId(id)),
    //     },
    //   };
    //   const result = await cardCollection.deleteMany(query);
    //   res.send({ paymentInfo, result });
    // });
    // পেমেন্ট সেভ করার সময় menuItemIds কে ObjectId-তে কনভার্ট করুন
    app.post("/payments", async (req, res) => {
      const payment = req.body;

      // নিশ্চিত করুন যে menuItemIds গুলো স্ট্রিং (ObjectId ফরম্যাটে)
      const menuItemIds = payment.menuItemIds.map((id) => {
        if (typeof id === "string") {
          return new ObjectId(id); // স্ট্রিং হলে ObjectId তে কনভার্ট
        }
        return id; // যদি ইতিমধ্যে ObjectId হয়
      });

      const paymentData = { ...payment, menuItemIds };
      const paymentInfo = await paymentCollection.insertOne(paymentData);

      // কার্ট আইটেম ডিলিট করার জন্য
      const deleteQuery = {
        _id: { $in: menuItemIds },
      };
      const deleteResult = await cardCollection.deleteMany(deleteQuery);

      res.send({ paymentInfo, deleteResult });
    });
    app.get("/payment/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    // stats or analytics
    app.get("/payment-stats", verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menuItem = await menuCollection.estimatedDocumentCount();
      const order = await paymentCollection.estimatedDocumentCount();
      // const payments = await paymentCollection.find().toArray();
      // const revenue = payments.reduce(
      //   (total, payment) => total + payment.price,
      //   0
      // );
      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();
      const revenue = result.length > 0 ? result[0].totalRevenue : 0;
      res.send({ users, menuItem, order, revenue });
    });
    // order aggregate
    app.get("/order-stats", async (req, res) => {
      const result = await paymentCollection
        .aggregate([
          {
            $unwind: "$menuItemIds",
          },
          {
            $lookup: {
              from: "menu",
              localField: "menuItemIds",
              foreignField: "_id",
              as: "menuItems",
            },
          },
          {
            $unwind: "$menuItems",
          },
          {
            $group: {
              _id: "$menuItems.category",
              quantity: { $sum: 1 },
              revenue: { $sum: "$menuItems.price" },
            },
          },
          {
            $project: {
              _id: 0,
              category: "$_id",
              quantity: "$quantity",
              revenue: "$revenue",
            },
          },
        ])
        .toArray();
      res.send(result);
    });
    // app.get("/order-stats", async (req, res) => {
    //   const result = await paymentCollection
    //     .aggregate([
    //       { $unwind: "$menuItemIds" }, // প্রতিটি menuItemId কে আলাদা ডকুমেন্টে রূপান্তর
    //       {
    //         $lookup: {
    //           // menu collection থেকে সম্পর্কিত ডাটা fetch করতে
    //           from: "menu",
    //           localField: "menuItemIds",
    //           foreignField: "_id",
    //           as: "menuItemDetails",
    //         },
    //       },
    //       { $unwind: "$menuItemDetails" }, // lookup ফলাফল unwind
    //       {
    //         $group: {
    //           _id: "$menuItemDetails.category",
    //           quantity: { $sum: 1 }, // প্রতিটি ক্যাটাগরির মোট quantity
    //           revenue: { $sum: "$menuItemDetails.price" }, // প্রতিটি ক্যাটাগরির মোট revenue
    //         },
    //       },
    //       {
    //         $project: {
    //           // ফলাফল ফরম্যাটিং
    //           category: "$_id",
    //           quantity: 1,
    //           revenue: 1,
    //           _id: 0,
    //         },
    //       },
    //     ])
    //     .toArray();

    //   res.send(result);
    // });
    // app.get("/debug-menu-ids", async (req, res) => {
    //   const payments = await paymentCollection
    //     .find({}, { projection: { menuItemIds: 1 } })
    //     .toArray();
    //   const menu = await menuCollection
    //     .find({}, { projection: { _id: 1, category: 1 } }) // category যোগ করুন
    //     .toArray();
    //   res.send({ payments, menu });
    // });
    // app.get("/fix-data", async (req, res) => {
    //   try {
    //     const payments = await paymentCollection.find().toArray();

    //     const updates = payments.map((payment) => {
    //       const fixedIds = payment.menuItemIds.map((id) =>
    //         typeof id === "string" ? new ObjectId(id) : id
    //       );

    //       return {
    //         updateOne: {
    //           filter: { _id: payment._id },
    //           update: { $set: { menuItemIds: fixedIds } },
    //         },
    //       };
    //     });

    //     if (updates.length > 0) {
    //       await paymentCollection.bulkWrite(updates);
    //     }

    //     res.send({
    //       message: "ডাটা সফলভাবে আপডেট হয়েছে",
    //       updatedCount: updates.length,
    //     });
    //   } catch (error) {
    //     console.error("ডাটা ফিক্স করতে সমস্যা:", error);
    //     res.status(500).send({ message: "ডাটা ফিক্স করতে সমস্যা হয়েছে" });
    //   }
    // });
    // app.get("/correct-order-stats", async (req, res) => {
    //   try {
    //     const result = await paymentCollection
    //       .aggregate([
    //         { $unwind: "$menuItemIds" },
    //         {
    //           $lookup: {
    //             from: "menu",
    //             let: { menuId: "$menuItemIds" },
    //             pipeline: [
    //               {
    //                 $match: {
    //                   $expr: {
    //                     $eq: ["$_id", "$$menuId"],
    //                   },
    //                 },
    //               },
    //             ],
    //             as: "menuItem",
    //           },
    //         },
    //         { $unwind: "$menuItem" },
    //         {
    //           $group: {
    //             _id: "$menuItem.category",
    //             quantity: { $sum: 1 },
    //             revenue: { $sum: "$menuItem.price" },
    //           },
    //         },
    //         {
    //           $project: {
    //             category: "$_id",
    //             quantity: 1,
    //             revenue: 1,
    //             _id: 0,
    //           },
    //         },
    //       ])
    //       .toArray();

    //     res.send(result);
    //   } catch (error) {
    //     console.error("স্ট্যাটিস্টিক্স বের করতে সমস্যা:", error);
    //     res
    //       .status(500)
    //       .send({ message: "স্ট্যাটিস্টিক্স বের করতে সমস্যা হয়েছে" });
    //   }
    // });
    // app.get("/manual-order-stats", async (req, res) => {
    //   try {
    //     const [payments, menuItems] = await Promise.all([
    //       paymentCollection.find().toArray(),
    //       menuCollection.find().toArray(),
    //     ]);

    //     const menuMap = new Map();
    //     menuItems.forEach((item) => {
    //       menuMap.set(item._id.toString(), item);
    //     });

    //     const stats = {};

    //     payments.forEach((payment) => {
    //       payment.menuItemIds.forEach((id) => {
    //         const item = menuMap.get(id.toString());
    //         if (item) {
    //           if (!stats[item.category]) {
    //             stats[item.category] = { quantity: 0, revenue: 0 };
    //           }
    //           stats[item.category].quantity += 1;
    //           stats[item.category].revenue += item.price;
    //         }
    //       });
    //     });

    //     const result = Object.keys(stats).map((category) => ({
    //       category,
    //       quantity: stats[category].quantity,
    //       revenue: stats[category].revenue,
    //     }));

    //     res.send(result);
    //   } catch (error) {
    //     console.error("ম্যানুয়াল স্ট্যাটিস্টিক্সে সমস্যা:", error);
    //     res
    //       .status(500)
    //       .send({ message: "ম্যানুয়াল স্ট্যাটিস্টিক্সে সমস্যা হয়েছে" });
    //   }
    // });
    // app.get("/check-data", async (req, res) => {
    //   // সব পেমেন্ট ডাটা নিন
    //   const payments = await paymentCollection.find().toArray();

    //   // সব মেনু আইটেম নিন
    //   const menuItems = await menuCollection.find().toArray();

    //   // কোন মেনু আইটেম অর্ডার হয়েছে তা চেক করুন
    //   const orderedItems = [];
    //   payments.forEach((payment) => {
    //     payment.menuItemIds.forEach((id) => {
    //       const item = menuItems.find((m) => m._id.equals(new ObjectId(id)));
    //       if (item) orderedItems.push(item);
    //     });
    //   });

    //   res.send({
    //     totalPayments: payments.length,
    //     totalMenuItems: menuItems.length,
    //     orderedItems: orderedItems,
    //     orderedCategories: [...new Set(orderedItems.map((i) => i.category))],
    //   });
    // });
    // app.get("/update-menu-ids", async (req, res) => {
    //   try {
    //     const payments = await paymentCollection.find().toArray();
    //     await Promise.all(
    //       payments.map(async (doc) => {
    //         const updatedIds = doc.menuItemIds.map(
    //           (id) => new ObjectId(String(id))
    //         );
    //         await paymentCollection.updateOne(
    //           { _id: doc._id },
    //           { $set: { menuItemIds: updatedIds } }
    //         );
    //       })
    //     );
    //     res.send({ message: "Successfully updated menuItemIds to ObjectId" });
    //   } catch (error) {
    //     console.error("Error updating menuItemIds:", error);
    //     res.status(500).send({ message: "Error updating menuItemIds" });
    //   }
    // });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("boss is running");
});
app.listen(port, () => {
  console.log(`server is running ${port}`);
});
