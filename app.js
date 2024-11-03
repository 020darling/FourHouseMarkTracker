const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const app = express();
const port = 3300;
const fileUpload = require("express-fileupload");
const csv = require("csv-parser");
const PDFDocument = require("pdfkit");
const fs = require("fs");

app.use(cors());
app.use(bodyParser.json());
app.use(fileUpload());

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password",
  database: "fucksba",
});

connection.connect((err) => {
  if (err) {
    console.error("ERROR! MESSAGE:", err);
    return;
  }
  console.log("DATABASE CONNECTED");
});

// Endpoint to get the list of students
app.get("/students", (req, res) => {
  const query = "SELECT * FROM Participant";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("QUERY ERROR:", err);
      res.status(500).send("QUERY ERROR");
      return;
    }
    res.json(results);
  });
});

// Endpoint to get the list of events
app.get("/events", (req, res) => {
  const query = "SELECT * FROM Event";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("QUERY ERROR:", err);
      res.status(500).send("QUERY ERROR");
      return;
    }
    res.json(results);
  });
});

// Endpoint to get the scores
app.get("/scores", (req, res) => {
  const query = "SELECT * FROM Mark";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("QUERY ERROR:", err);
      res.status(500).send("QUERY ERROR");
      return;
    }
    res.json(results);
  });
});

// Endpoint to query students by house
app.get("/students/house/:houseName", (req, res) => {
  const houseName = req.params.houseName;
  const query = `
    SELECT Participant.Name AS StudentName
    FROM Participant
    JOIN House ON Participant.HouseID = House.ID
    WHERE House.Name = ?;
  `;
  connection.query(query, [houseName], (err, results) => {
    if (err) {
      console.error("QUERY ERROR:", err);
      res.status(500).send("QUERY ERROR");
      return;
    }
    res.json(results);
  });
});

// Endpoint to query students and scores by house
app.get("/students/scores/house/:houseName", (req, res) => {
  const houseName = req.params.houseName;
  const query = `
    SELECT Participant.Name AS StudentName, Event.Name AS EventName, Mark.Score
    FROM Mark
    JOIN Participant ON Mark.StudentID = Participant.StudentID
    JOIN Event ON Mark.EventID = Event.ID
    JOIN House ON Participant.HouseID = House.ID
    WHERE House.Name = ?;
  `;
  connection.query(query, [houseName], (err, results) => {
    if (err) {
      console.error("QUERY ERROR:", err);
      res.status(500).send("QUERY ERROR");
      return;
    }
    res.json(results);
  });
});

// Endpoint to query house total score
app.get("/houses", (req, res) => {
  const query = `
    SELECT Name, totalScore
    FROM House;
  `;
  connection.query(query, (err, results) => {
    if (err) {
      console.error("QUERY ERROR:", err);
      res.status(500).send("QUERY ERROR");
      return;
    }
    res.json(results);
  });
});

// Endpoint to query student scores by ID
app.get("/student/:id", (req, res) => {
  const studentID = req.params.id;
  const query = `
    SELECT Event.Name AS EventName, Mark.Score
    FROM Mark
    JOIN Event ON Mark.EventID = Event.ID
    WHERE Mark.StudentID = ?;
  `;
  connection.query(query, [studentID], (err, results) => {
    if (err) {
      console.error("QUERY ERROR:", err);
      res.status(500).send("QUERY ERROR");
      return;
    }
    res.json(results);
  });
});

// Endpoint to query students and scores by event ID
app.get("/event/:eventId/participants", (req, res) => {
  const eventId = req.params.eventId;
  const query = `
    SELECT Participant.Name AS StudentName, Mark.Score
    FROM Mark
    JOIN Participant ON Mark.StudentID = Participant.StudentID
    WHERE Mark.EventID = ?;
  `;
  connection.query(query, [eventId], (err, results) => {
    if (err) {
      console.error("QUERY ERROR:", err);
      res.status(500).send("QUERY ERROR");
      return;
    }
    res.json(results);
  });
});

// Endpoint to add a student
app.post("/student", (req, res) => {
  const { studentID, name, age, houseID } = req.body;
  const query = `
    INSERT INTO Participant (StudentID, Name, Age, HouseID)
    VALUES (?, ?, ?, ?);
  `;
  connection.query(query, [studentID, name, age, houseID], (err, results) => {
    if (err) {
      console.error("ERROR IN ADDING STUDENT:", err);
      res.status(500).send("AN ERROR DURING ADD THE STUDENT");
      return;
    }
    res.send("ADD STUDENT SUCCESSFUL");
  });
});

// Endpoint to add an event
app.post("/event", (req, res) => {
  const { eventName, scoreType } = req.body;
  const query = `
    INSERT INTO Event (Name, ScoreType)
    VALUES (?, ?);
  `;
  connection.query(query, [eventName, scoreType], (err, results) => {
    if (err) {
      console.error("ERROR IN ADDING SPORT EVENT:", err);
      res.status(500).send("AN ERROR DURING ADD THE SPORT EVENT");
      return;
    }
    res.send("ADD NEW SPORT EVENT SUCCESSFUL");
  });
});

// Endpoint to add a result
app.post("/result", (req, res) => {
  const { studentID, eventID, score } = req.body;
  const query = `
    INSERT INTO Mark (StudentID, EventID, Score)
    VALUES (?, ?, ?);
  `;
  connection.query(query, [studentID, eventID, score], (err, results) => {
    if (err) {
      console.error("ERROR IN ENTERING NEW RESULT:", err);
      res.status(500).send("AN ERROR DURING ENTER THE RESULT");
      return;
    }
    res.send("ADD NEW RESULT SUCCESSFUL");
  });
});

// Endpoint to upload CSV and add students
app.post("/upload-csv", (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send("No files were uploaded.");
  }

  const studentFile = req.files.file;
  const filePath = `./uploads/${studentFile.name}`;

  studentFile.mv(filePath, (err) => {
    if (err) return res.status(500).send(err);

    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        // Insert data into database
        const query =
          "INSERT INTO Participant (StudentID, Name, Age, HouseID) VALUES ?";
        const values = results.map((student) => [
          student.StudentID,
          student.Name,
          student.Age,
          student.HouseID,
        ]);

        connection.query(query, [values], (err) => {
          if (err) {
            console.error("Error inserting data:", err);
            return res.status(500).send("Error inserting data");
          }
          res.send("Students added successfully");
        });

        // Delete the file after processing
        fs.unlinkSync(filePath);
      });
  });
});

// DELETE STUDENTS
app.delete("/student/:id", (req, res) => {
  const studentID = req.params.id;
  const query = "DELETE FROM Participant WHERE StudentID = ?";
  connection.query(query, [studentID], (err, results) => {
    if (err) {
      console.error("ERROR IN DELETING STUDENT:", err);
      res.status(500).send("AN ERROR DURING DELETE THE STUDENT");
      return;
    }
    res.send("STUDENT DELETE SUCCESSFUL");
  });
});

// DELETE SPORT
app.delete("/event/:id", (req, res) => {
  const eventID = req.params.id;

  connection.beginTransaction((err) => {
    if (err) {
      return res.status(500).send("Transaction error");
    }

    // DELETE RESULT
    connection.query(
      "DELETE FROM Mark WHERE EventID = ?",
      [eventID],
      (err, results) => {
        if (err) {
          return connection.rollback(() => {
            res.status(500).send("Error deleting scores");
          });
        }

        // DELETE SPORT
        connection.query(
          "DELETE FROM Event WHERE ID = ?",
          [eventID],
          (err, results) => {
            if (err) {
              return connection.rollback(() => {
                res.status(500).send("Error deleting event");
              });
            }

            connection.commit((err) => {
              if (err) {
                return connection.rollback(() => {
                  res.status(500).send("Commit error");
                });
              }
              res.send("EVENT DELETE SUCCESSFUL");
            });
          }
        );
      }
    );
  });
});

// DELETE RESULT
app.delete("/score/:id", (req, res) => {
  const scoreID = req.params.id;
  const query = "DELETE FROM Mark WHERE ID = ?";
  connection.query(query, [scoreID], (err, results) => {
    if (err) {
      console.error("AN ERROR DURING DELETE THE RESULT:", err);
      res.status(500).send("AN ERROR DURING DELETE THE RESULT");
      return;
    }
    res.send("DELETE RESULT SUCCESSFUL");
  });
});

// DELETE ALL RESULT
app.delete("/scores", (req, res) => {
  const query = "DELETE FROM Mark";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("AN ERROR DURING DELETE THE RESULT:", err);
      res.status(500).send("AN ERROR DURING DELETE THE RESULT");
      return;
    }
    res.send("ALL RESULT HAS BEEN DELETED");
  });
});

// UPDATE STUDENT INFORMATION
app.put("/student/:id", (req, res) => {
  const studentID = req.params.id;
  const { name, age, houseID } = req.body;
  let fields = [];
  let values = [];

  if (name) {
    fields.push("Name = ?");
    values.push(name);
  }
  if (age) {
    fields.push("Age = ?");
    values.push(age);
  }
  if (houseID) {
    fields.push("HouseID = ?");
    values.push(houseID);
  }

  if (fields.length === 0) {
    return res.status(400).send("NO ANY DATA NEED TO UPDATE");
  }

  const query = `UPDATE Participant SET ${fields.join(
    ", "
  )} WHERE StudentID = ?`;
  values.push(studentID);

  connection.query(query, values, (err, results) => {
    if (err) {
      console.error("AN ERROR WHEN MODIFY THE STUDENT INFORMATION:", err);
      res.status(500).send("AN ERROR WHEN MODIFY THE STUDENT INFORMATION");
      return;
    }
    res.send("STUDENT INFORMATION MODIFY SUCCESSFUL");
  });
});

// UPDATE EVENT
app.put("/event/:id", (req, res) => {
  const eventID = req.params.id;
  const { eventName, scoreType } = req.body;
  let fields = [];
  let values = [];

  if (eventName) {
    fields.push("Name = ?");
    values.push(eventName);
  }
  if (scoreType) {
    fields.push("ScoreType = ?");
    values.push(scoreType);
  }

  if (fields.length === 0) {
    return res.status(400).send("NO ANY DATA NEED TO UPDATE");
  }

  const query = `UPDATE Event SET ${fields.join(", ")} WHERE ID = ?`;
  values.push(eventID);

  connection.query(query, values, (err, results) => {
    if (err) {
      console.error("AN ERROR WHEN MODIFY THE EVENT:", err);
      res.status(500).send("AN ERROR WHEN MODIFY THE EVENT");
      return;
    }
    res.send("EVENT MODIFY SUCCESSFUL");
  });
});

// UPDATE RESULT
app.put("/score/:id", (req, res) => {
  const scoreID = req.params.id;
  const { score } = req.body;

  if (!score) {
    return res.status(400).send("NO ANY DATA NEED TO UPDATE");
  }

  const query = "UPDATE Mark SET Score = ? WHERE ID = ?";
  connection.query(query, [score, scoreID], (err, results) => {
    if (err) {
      console.error("AN ERROR WHEN MODIFY THE RESULT:", err);
      res.status(500).send("AN ERROR WHEN MODIFY THE RESULT");
      return;
    }
    res.send("RESULT UPDATE SUCCESSFUL");
  });
});

app.get("/generate-student-report", (req, res) => {
  const query = "SELECT * FROM Participant";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("AN ERROR DURING QUERY:", err);
      res.status(500).send("AN ERROR DURING QUERY");
      return;
    }

    const doc = new PDFDocument();
    const fileName = `Student_Report_${Date.now()}.pdf`;
    const filePath = `./reports/${fileName}`;

    doc.pipe(fs.createWriteStream(filePath));

    doc.fontSize(18).text("The Report Of Student List", { align: "center" });
    doc
      .fontSize(12)
      .text(`Issue Date: ${new Date().toLocaleString()}`, { align: "right" });

    doc.moveDown();

    results.forEach((student) => {
      doc
        .fontSize(12)
        .text(
          `Student ID: ${student.StudentID}, Legal Name: ${student.Name}, Age: ${student.Age}, House ID: ${student.HouseID}`
        );
    });

    doc.end();

    doc.on("finish", () => {
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error("AN ERROR DURING DOWNLOAD:", err);
          res.status(500).send("AN ERROR DURING DOWNLOAD");
        }
        fs.unlinkSync(filePath);
      });
    });
  });
});

app.get("/generate-event-report", (req, res) => {
  const query = "SELECT * FROM Event";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("AN ERROR DURING QUERY:", err);
      res.status(500).send("AN ERROR DURING QUERY");
      return;
    }

    const doc = new PDFDocument();
    const fileName = `Event_Report_${Date.now()}.pdf`;
    const filePath = `./reports/${fileName}`;

    doc.pipe(fs.createWriteStream(filePath));

    doc.fontSize(18).text("The Report Of Sport Events", { align: "center" });
    doc
      .fontSize(12)
      .text(`Issue Date: ${new Date().toLocaleString()}`, { align: "right" });

    doc.moveDown();

    results.forEach((event) => {
      doc
        .fontSize(12)
        .text(
          `Sport Event ID: ${event.ID}, Event Name: ${event.Name}, The Type Of Score: ${event.ScoreType}`
        );
    });

    doc.end();

    doc.on("finish", () => {
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error("AN ERROR DURING DOWNLOAD:", err);
          res.status(500).send("AN ERROR DURING DOWNLOAD");
        }
        fs.unlinkSync(filePath);
      });
    });
  });
});

app.get("/generate-all-scores-report", (req, res) => {
  const query = `
    SELECT Participant.Name AS StudentName, Event.Name AS EventName, Mark.Score
    FROM Mark
    JOIN Participant ON Mark.StudentID = Participant.StudentID
    JOIN Event ON Mark.EventID = Event.ID;
  `;
  connection.query(query, (err, results) => {
    if (err) {
      console.error("ERROR:", err);
      res.status(500).send("ERROR");
      return;
    }

    const doc = new PDFDocument();
    const fileName = `All_Scores_Report_${Date.now()}.pdf`;
    const filePath = `./reports/${fileName}`;

    doc.pipe(fs.createWriteStream(filePath));

    doc
      .fontSize(18)
      .text("The Report Of All Score Records", { align: "center" });
    doc
      .fontSize(12)
      .text(`Issue Date: ${new Date().toLocaleString()}`, { align: "right" });

    doc.moveDown();

    results.forEach((record) => {
      doc
        .fontSize(12)
        .text(
          `Student Legal Name: ${record.StudentName}, Event Name: ${record.EventName}, Final Score: ${record.Score}`
        );
    });

    doc.end();

    doc.on("finish", () => {
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error("AN ERROR DURING DOWNLOAD:", err);
          res.status(500).send("AN ERROR DURING DOWNLOAD");
        }
        fs.unlinkSync(filePath);
      });
    });
  });
});

app.get("/generate-students-by-house/:houseName", (req, res) => {
  const houseName = req.params.houseName;
  const query = `
    SELECT Participant.Name AS StudentName
    FROM Participant
    JOIN House ON Participant.HouseID = House.ID
    WHERE House.Name = ?;
  `;
  connection.query(query, [houseName], (err, results) => {
    if (err) {
      console.error("AN ERROR DURING QUERY:", err);
      res.status(500).send("AN ERROR DURING QUERY");
      return;
    }

    const doc = new PDFDocument();
    const fileName = `Students_by_House_${houseName}_${Date.now()}.pdf`;
    const filePath = `./reports/${fileName}`;

    doc.pipe(fs.createWriteStream(filePath));

    doc
      .fontSize(18)
      .text(`The Student House Of: ${houseName} House`, { align: "center" });
    doc
      .fontSize(12)
      .text(`Issue Date: ${new Date().toLocaleString()}`, { align: "right" });

    doc.moveDown();

    results.forEach((student) => {
      doc.fontSize(12).text(`Student Legal Name: ${student.StudentName}`);
    });

    doc.end();

    doc.on("finish", () => {
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error("AN ERROR DURING DOWNLOAD:", err);
          res.status(500).send("AN ERROR DURING DOWNLOAD");
        }
        fs.unlinkSync(filePath);
      });
    });
  });
});

app.get("/generate-scores-by-student/:id", (req, res) => {
  const studentID = req.params.id;
  const query = `
    SELECT Event.Name AS EventName, Mark.Score
    FROM Mark
    JOIN Event ON Mark.EventID = Event.ID
    WHERE Mark.StudentID = ?;
  `;
  connection.query(query, [studentID], (err, results) => {
    if (err) {
      console.error("AN ERROR DURING QUERY:", err);
      res.status(500).send("AN ERROR DURING QUERY");
      return;
    }

    const doc = new PDFDocument();
    const fileName = `Scores_by_Student_${studentID}_${Date.now()}.pdf`;
    const filePath = `./reports/${fileName}`;

    doc.pipe(fs.createWriteStream(filePath));

    doc
      .fontSize(18)
      .text(`The Mark Record Report Of Student ID: ${studentID} `, {
        align: "center",
      });
    doc
      .fontSize(12)
      .text(`Issue Date: ${new Date().toLocaleString()}`, { align: "right" });

    doc.moveDown();

    results.forEach((score) => {
      doc
        .fontSize(12)
        .text(`Event Name: ${score.EventName}, Final Score: ${score.Score}`);
    });

    doc.end();

    doc.on("finish", () => {
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error("AN ERROR DURING DOWNLOAD:", err);
          res.status(500).send("AN ERROR DURING DOWNLOAD");
        }
        fs.unlinkSync(filePath);
      });
    });
  });
});

app.get("/generate-participants-by-event/:eventId", (req, res) => {
  const eventId = req.params.eventId;
  const query = `
    SELECT Participant.Name AS StudentName, Mark.Score
    FROM Mark
    JOIN Participant ON Mark.StudentID = Participant.StudentID
    WHERE Mark.EventID = ?;
  `;
  connection.query(query, [eventId], (err, results) => {
    if (err) {
      console.error("AN ERROR DURING QUERY:", err);
      res.status(500).send("AN ERROR DURING QUERY");
      return;
    }

    const doc = new PDFDocument();
    const fileName = `Participants_by_Event_${eventId}_${Date.now()}.pdf`;
    const filePath = `./reports/${fileName}`;

    doc.pipe(fs.createWriteStream(filePath));

    doc.fontSize(18).text(`The Sport Event Result Report Of ID: ${eventId}`, {
      align: "center",
    });
    doc
      .fontSize(12)
      .text(`Issue Date: ${new Date().toLocaleString()}`, { align: "right" });

    doc.moveDown();

    results.forEach((participant) => {
      doc
        .fontSize(12)
        .text(
          `Student Legal Name: ${participant.StudentName}, Result(Time/Distance): ${participant.Score}`
        );
    });

    doc.end();

    doc.on("finish", () => {
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error("AN ERROR DURING DOWNLOAD:", err);
          res.status(500).send("AN ERROR DURING DOWNLOAD");
        }
        fs.unlinkSync(filePath);
      });
    });
  });
});

//for mark calculaing code below
//-------------------------------
//-------------------------------

app.get("/house-scores", (req, res) => {
  calculateHouseScores((err, scores) => {
    if (err) {
      return res.status(500).json({ error: "Error calculating scores" });
    }

    const allScores = Object.values(scores);
    const maxScore = Math.max(...allScores);
    const leadingTeams = Object.keys(scores).filter(
      (team) => scores[team] === maxScore
    );

    const result = {
      scores,
      leader: leadingTeams.length > 1 ? "FAIR" : leadingTeams[0],
    };

    res.json(result);
  });
});

function calculateHouseScores(callback) {
  const houseQuery = `SELECT Name FROM House;`;

  connection.query(houseQuery, (err, houses) => {
    if (err) {
      console.error("ERROR:", err);
      return callback(err);
    }

    const houseScores = {};

    houses.forEach((house) => {
      houseScores[house.Name] = 0;
    });

    const scoreQuery = `
      SELECT House.Name AS HouseName, Event.ID AS EventID, Event.ScoreType, Mark.Score
      FROM Mark
      JOIN Participant ON Mark.StudentID = Participant.StudentID
      JOIN Event ON Mark.EventID = Event.ID
      JOIN House ON Participant.HouseID = House.ID;
    `;

    connection.query(scoreQuery, (err, results) => {
      if (err) {
        console.error("ERROR:", err);
        return callback(err);
      }

      if (results.length === 0) {
        return callback(null, houseScores);
      }

      const groupedByEvent = results.reduce((acc, record) => {
        const { EventID } = record;
        if (!acc[EventID]) {
          acc[EventID] = [];
        }
        acc[EventID].push(record);
        return acc;
      }, {});

      for (const eventId in groupedByEvent) {
        const eventResults = groupedByEvent[eventId];

        if (eventResults.length < 3) continue;

        const scoreType = eventResults[0].ScoreType;

        if (scoreType === "Time") {
          eventResults.sort((a, b) => a.Score - b.Score);
        } else if (scoreType === "Distance") {
          eventResults.sort((a, b) => b.Score - a.Score);
        }

        let points = [3, 2, 1];
        let currentRank = 0;
        let lastScore = null;
        let lastRank = 0;

        for (let i = 0; i < eventResults.length && currentRank < 3; i++) {
          const record = eventResults[i];

          if (lastScore !== null && record.Score === lastScore) {
            houseScores[record.HouseName] += points[lastRank];
          } else {
            houseScores[record.HouseName] += points[currentRank];
            lastScore = record.Score;
            lastRank = currentRank;
            currentRank++;
          }
        }
      }

      callback(null, houseScores);
    });
  });
}
// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
