require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mssql = require("mssql");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const config = {
  server: process.env.DB_SERVER,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT, 10),
  options: {
    trustedConnection: true,
    enableArithAbort: true,
    encrypt: false,
    requestTimeout: 300000,
  },
};

const pool = new mssql.ConnectionPool(config);

pool.connect((err) => {
  if (err) {
    console.error("Error connecting to MSSQL:", err);
    return;
  }
  console.log("Connected to MSSQL!");
});

const executeQuery = (query, params, res) => {
  return pool
    .request()
    .query(query, params)
    .then((result) => {
      res.status(200).json(result.recordset);
    })
    .catch((err) => {
      console.error("Error executing query:", err);
      res.status(500).json({ error: "Failed to execute query" });
    });
};

app.post(
  "/cif",
  upload.fields([
    { name: "signature", maxCount: 1 },
    { name: "picture", maxCount: 1 },
  ]),
  (req, res) => {
    const {
      cifKey,
      memberName,
      spouse,
      sitioPurok,
      barangay,
      municipality,
      district,
    } = req.body;
    const { signature, picture } = req.files;

    const query = `INSERT INTO CIF (
      [CIF Key], [Member Name], Spouse, [Sitio Purok], Barangay, Municipality, District, [Signature Of Member], Picture, DateCreated
    ) VALUES (@cifKey, @memberName, @spouse, @sitioPurok, @barangay, @municipality, @district, @signature, @picture, GETDATE());`;

    const request = new mssql.Request(pool);

    request.input("cifKey", mssql.VarChar, cifKey);
    request.input("memberName", mssql.VarChar, memberName);
    request.input("spouse", mssql.VarChar, spouse);
    request.input("sitioPurok", mssql.VarChar, sitioPurok);
    request.input("barangay", mssql.VarChar, barangay);
    request.input("municipality", mssql.VarChar, municipality);
    request.input("district", mssql.Int, district);

    if (signature && signature[0] && signature[0].buffer) {
      request.input("signature", mssql.VarBinary, signature[0].buffer);
    } else {
      request.input("signature", mssql.VarBinary, null);
    }

    if (picture && picture[0] && picture[0].buffer) {
      request.input("picture", mssql.VarBinary, picture[0].buffer);
    } else {
      request.input("picture", mssql.VarBinary, null);
    }

    request.query(query, (err, result) => {
      if (err) {
        console.error("Error adding CIF:", err);
        res.status(500).json({ error: "Failed to add CIF record" });
        return;
      }
      res.status(201).json({
        message: "CIF record added successfully",
        insertId: result.rowsAffected[0],
      });
    });
  }
);

app.get("/cif", (req, res) => {
  const query =
    "SELECT [CIF Key], [Member Name], Spouse, [Sitio Purok], Barangay, Municipality, District, [Signature Of Member], Picture, DateCreated FROM CIF;";
  executeQuery(query, [], res);
});

app.get("/cif/:cifKey", (req, res) => {
  const cifKey = req.params.cifKey;
  const query =
    "SELECT [CIF Key], [Member Name], Spouse, [Sitio Purok], Barangay, Municipality, District, [Signature Of Member], Picture, DateCreated FROM CIF WHERE [CIF Key] = @cifKey;";
  executeQuery(
    query,
    [{ name: "cifKey", type: mssql.VarChar, value: cifKey }],
    res
  );
});

app.put("/cif/:cifKey", (req, res) => {
  const cifKey = req.params.cifKey;
  const { memberName, spouse, sitioPurok, barangay, municipality, district } =
    req.body;

  const query = `UPDATE CIF SET 
        [Member Name] = @memberName, Spouse = @spouse, [Sitio Purok] = @sitioPurok, 
        Barangay = @barangay, Municipality = @municipality, District = @district
        WHERE [CIF Key] = @cifKey;`;

  const request = new mssql.Request(pool);

  request.input("cifKey", mssql.VarChar, cifKey);
  request.input("memberName", mssql.VarChar, memberName);
  request.input("spouse", mssql.VarChar, spouse);
  request.input("sitioPurok", mssql.VarChar, sitioPurok);
  request.input("barangay", mssql.VarChar, barangay);
  request.input("municipality", mssql.VarChar, municipality);
  request.input("district", mssql.Int, district);

  request.query(query, (err, result) => {
    if (err) {
      console.error("Error updating CIF:", err);
      res.status(500).json({ error: "Failed to update CIF record" });
      return;
    }
    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ message: "CIF record not found" });
      return;
    }
    res.status(200).json({ message: "CIF record updated successfully" });
  });
});

app.get("/cif/search/:memberName", (req, res) => {
  const memberName = req.params.memberName;
  const query =
    "SELECT [CIF Key], [Member Name], Spouse, [Sitio Purok], Barangay, Municipality, District, [Signature Of Member], Picture, DateCreated FROM CIF WHERE [Member Name] = @memberName;"; // Exact match
  executeQuery(
    query,
    [{ name: "memberName", type: mssql.VarChar, value: memberName }],
    res
  );
});

app.get("/raffle-tickets", (req, res) => {
  const query = "SELECT [CIF Key] FROM CIF;";
  executeQuery(query, [], res);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
