const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

let db = null;
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started");
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};

initializeDBAndServer();

// Login API 1
app.post("/login/", async (request, response) => {
  try {
    const { username, password } = request.body;
    const userQuery = `SELECT * FROM user WHERE username = '${username}'`;

    const dbUser = await db.get(userQuery);

    if (dbUser === undefined) {
      response.status(400);
      response.send("Invalid user");
    } else {
      const passwordCheck = await bcrypt.compare(password, dbUser.password);

      if (!passwordCheck) {
        response.status(400);
        response.send("Invalid password");
      } else {
        const payload = { username: username };
        const jwtToken = jwt.sign(payload, "KEY");
        response.send({ jwtToken });
      }
    }
  } catch (e) {
    console.log(e);
  }
});

// JWTTOKEN Authentication
const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//GET States Data API 2
app.get("/states/", authenticationToken, async (request, response) => {
  try {
    const allStatesQuery = `
    SELECT
        state_id AS stateId, 
        state_name AS stateName, 
        population 
    FROM 
        state;
    `;

    const allStates = await db.all(allStatesQuery);
    response.send(allStates);
  } catch (e) {
    console.log(e);
  }
});

//GET State Data API 3
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  try {
    const { stateId } = request.params;
    const stateQuery = `
    SELECT 
        state_id AS stateId, 
        state_name AS stateName, 
        population 
    FROM 
        state 
    WHERE 
        state_id = ${stateId};
    `;
    const state = await db.get(stateQuery);
    response.send(state);
  } catch (e) {
    console.log(e);
  }
});

//POST Districts API 4
app.post("/districts/", authenticationToken, async (request, response) => {
  try {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const uploadDistrictQuery = `
    INSERT INTO 
        district(
            district_name, 
            state_id, 
            cases, 
            cured, 
            active, 
            deaths
        ) 
        VALUES(
            '${districtName}', 
            ${stateId}, 
            ${cases}, 
            ${cured}, 
            ${active}, 
            ${deaths}
        );
        `;

    const newDistrict = await db.run(uploadDistrictQuery);
    response.send("District Successfully Added");
  } catch (e) {
    console.log(e);
  }
});

//GET District Data API 5
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    try {
      const { districtId } = request.params;
      const districtQuery = `
      SELECT 
        district_id AS districtId, 
        district_name as districtName, 
        state_id AS stateId, 
        cases, 
        cured, 
        active, 
        deaths 
      FROM 
        district 
      WHERE 
        district_id = ${districtId};
      `;

      const district = await db.get(districtQuery);
      response.send(district);
    } catch (e) {
      console.log(e);
    }
  }
);

//DELETE District Data API 6
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    try {
      const { districtId } = request.params;
      const deleteDistrictQuery = `
      DELETE 
      FROM 
        district 
      WHERE 
        district_id = ${districtId};
      `;

      await db.run(deleteDistrictQuery);
      response.send("District Removed");
    } catch (e) {
      console.log(e);
    }
  }
);

//PUT District Data API 7
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    try {
      const { districtId } = request.params;
      const {
        districtName,
        stateId,
        cases,
        cured,
        active,
        deaths,
      } = request.body;
      const updateDistrictQuery = `
      UPDATE 
        district 
      SET 
        district_name = '${districtName}', 
        state_id = ${stateId}, 
        cases = ${cases}, 
        cured = ${cured}, 
        active = ${active}, 
        deaths = ${deaths};
      `;

      await db.run(updateDistrictQuery);
      response.send("District Details Updated");
    } catch (e) {
      console.log(e);
    }
  }
);

//GET States Stats API 8
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    try {
      const { stateId } = request.params;
      const statsQuery = `
      SELECT 
        SUM(cases) AS totalCases, 
        SUM(cured) AS totalCured, 
        SUM(active) AS totalActive, 
        SUM(deaths) AS totalDeaths 
      FROM 
        district 
      WHERE 
        state_id = ${stateId};
      `;

      const stats = await db.get(statsQuery);
      response.send(stats);
    } catch (e) {
      console.log(e);
    }
  }
);

module.exports = app;
