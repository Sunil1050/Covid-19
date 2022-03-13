const express = require('express');
app = express();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {open} = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const dbPath = path.join(__dirname,'covid19IndiaPortal.db');
app.use(express.json());
let db = null;


const initializeDbAndServer = async () => {
    try    
    {
        db = await open({filename:dbPath,driver:sqlite3.Database});
        app.listen(3000, () => {
        console.log('Server running at http://localhost:3000/');
        });  
    }
    catch(e){
        console.log(`DB error: ${e.message}`);
        process.exit(1);
    }
};

initializeDbAndServer();

const authenticateToken = (request,response,next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    
    if (authHeader !== undefined){
        jwtToken = authHeader.split(' ')[1]    
    }    
    
    if (jwtToken === undefined){
        response.status(401);        
        response.send('Invalid JWT Token');
    }
    else{
        jwt.verify(jwtToken,"kjzghdifbf",async (error,payLoad)=>{
        if (error){
            response.status(401);
            response.send('Invalid JWT Token')            
        }
        else{
            next();  
        }        
    })   
    }

}


//Register User API

app.post('/register/',async (request,response) =>{
    const {username,name,password,gender,location} = request.body;
    const encryptedPwd = await bcrypt.hash(password,10);
    const selectUserQuery = `
    SELECT *
    FROM user
    WHERE username = '${username}';`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined){
        const createUserQuery = `
        INSERT INTO user
            (username,name,password,gender,location)
        VALUES
            ('${username}',
            '${name}',
            '${encryptedPwd}',
            '${gender}',
            '${location}')`;   
        const newUser = db.run(createUserQuery);
        response.status(200);
        response.send('User created Successfully');
    }
    else{
        response.status(400);
        response.send('User Already exists');
    }
});

//Login User API

app.post('/login/',async (request,response)=>{
    const {username,password} = request.body;
    const selectUserQuery = `
    SELECT *
    FROM user
    WHERE username = '${username}';`;
    const dbUser = await db.get(selectUserQuery);
    console.log(dbUser);

    if (dbUser === undefined){
        response.status(400);
        response.send('Invalid user'); 
    }
    else{
        isPasswordMatch = await bcrypt.compare(password,dbUser.password);
        if (isPasswordMatch === true){
            const payLoad = {username};
            const jwtToken = jwt.sign(payLoad,"kjzghdifbf");
            response.send({jwtToken});
        }    
        else{
            response.status(400);
            response.send('Invalid password');
        }            
    }    
})

//GET all states

app.get('/states/',authenticateToken,async (request,response) =>{
    const getAllStates = `
    SELECT 
        state_id AS stateId,
        state_name AS stateName,
        population AS population 
    FROM state
    ORDER BY state_id = 'ASC';`;
    const statesArray = await db.all(getAllStates);
    response.send(statesArray);

});

//GET state by stateId

app.get('/states/:stateId/',authenticateToken,async (request,response)=>{
   const {stateId} = request.params;
   const getStateQuery = `
   SELECT 
        state_id AS stateId,
        state_name AS stateName,
        population AS population
   FROM state
   WHERE state_id = ${stateId};`;
   const state = await db.get(getStateQuery);
   response.send(state);
})



//Create districts -POST API

app.post('/districts/',authenticateToken,async (request,response)=>{
    const {districtName,stateId,cases,cured,active,deaths} = request.body;
    const createDistrict = `
    INSERT INTO district
        (district_name,state_id,cases,cured,active,deaths)
    VALUES
        ('${districtName}',
        '${stateId}',
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}');`;
    const newDistrict = await db.run(createDistrict);
    const newDistrictId = newDistrict.lastID;
    response.send(`District Successfully Added`);  
});

//GET district by districtId

app.get('/districts/:districtId/',authenticateToken,async (request,response)=>{
   const {districtId} = request.params;
   const getDistrict = `
    SELECT 
        district_id AS districtId,
        district_name AS districtName,
        state_id AS stateId,
        cases,cured,active,deaths
    FROM district
    WHERE district_id = ${districtId}`;
   const district = await db.get(getDistrict);
   response.send(district);
});

//Delete a district -DELETE API

app.delete('/districts/:districtId/',authenticateToken,async (request,response)=>{
    const {districtId} = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send('District Removed');

});

//Update district details - PUT API

app.put('/districts/:districtId/', authenticateToken,async (request,response)=>{
    const {districtId} = request.params;
    const {districtName,stateId,cases,cured,active,deaths} = request.body;
    const updateDistrictQuery = `
    UPDATE 
        district 
    SET 
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send('District Details Updated');

});

//GET stats of a state

app.get('/states/:stateId/stats/',authenticateToken,async (request,response)=>{
    const {stateId} = request.params;
    const getStatsQuery = `
    SELECT 
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id = ${stateId};`;
    const stateStats = await db.get(getStatsQuery);
    response.send(stateStats);
});

module.exports = app;