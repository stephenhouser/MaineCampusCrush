/* 
 * Maine Campus Crush
 *
 * A Bejewled clone for public higher education in Maine.
 * Client based on http://www.emanueleferonato.com/2011/10/07/complete-bejeweled-prototype-made-wiht-jquery/
 * Server based on https://mashe.hawksey.info/2014/07/google-sheets-as-a-database-insert-with-apps-script-using-postget-methods-with-ajax-example/
 *
 * February 1, 2015 - Stephen Houser
 *
 * Copyright (C) 2015 Stephen Houser
 * This work is licensed inder a Creative Commons Attribution-Noncommercial-Share
 * Alike 3.0 United States License (CC BY-NC-SA 3.0 US)
 * http://creativecommons.org/licenses/by-nc-sa/3.0/us/
 * ----------------------------------------------------------------------------
 * "THE BEER-WARE LICENSE" (Revision 42):
 * As long as you retain this notice you can do whatever you want with this stuff. 
 * If we meet some day, and you think this stuff is worth it, you can buy me a beer
 * in return. 
 * ----------------------------------------------------------------------------
 */

/*
 * Code.gs -- Google Script API for Score tracking
 * Handles posting scores from Maine Campus Crush game to google spreadsheet.
 * Return high scores for each team
 * JSONP based to allow cross domain functionality.
 */
 
// Name of the sheets to modify and get data from
var scoreSheetName = "All Scores";
var leaderboardSheetName = "Leaderboard";

// LEADERBOARD Columns
// Columns are: 0-Date, 1-Score, 2-Team, 3-Player, 4-Campus, 5-Mascot, 6-Notes
var colDate = 0,
    colScore = 1,
    colTeam = 2,
    colPlayer = 3,
    colCampus = 4,
    colMascot = 5,
    colNotes = 6;


// Google property service
var scriptProperties = PropertiesService.getScriptProperties(); 

function setup() {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    scriptProperties.setProperty("key", doc.getId());
}

function doGet(request) {
  return handleResponse(request);
}
 
function doPost(request) {
  return handleResponse(request);
}
 
function JSONPify(callbackName, data) {
  return callbackName + "(" + JSON.stringify(data) + ")";
}

function isInt(number) {
    return (typeof number==="number" && (number%1)===0);
}

function handleResponse(request) {
  // Set callback function for JSONP results
  var callbackFunctionName = "callback";
  if (request.parameters.callback) {
    callbackFunctionName = request.parameters.callback;
  }
    
  // The LockService[1] prevents concurrent access overwritting data.
  // [1] http://googleappsdeveloper.blogspot.co.uk/2011/10/concurrency-and-google-apps-script.html
  // we want a public lock, one that locks for all invocations
  var lock = LockService.getPublicLock();
  lock.waitLock(10000);  // wait 10 seconds before conceding defeat.
   
  try {
    // Set where we write the data
    var doc = SpreadsheetApp.openById(scriptProperties.getProperty("key"));

    // ===== RECORD SCORE =====
    // If a score is provided, then add to the score log
    var score = parseInt(request.parameter.score, 10);
    if (isInt(score)) {
      var scoreSheet = doc.getSheetByName(scoreSheetName);
      
      // Optional team number
      var team = parseInt(request.parameter.team, 10);
      if (!isInt(team)) {
        team = 0;
      }
      
      // Optional player name (initials)
      var player = request.parameter.player;
      if (!player) {
        player = "";
      }

      // Header is in row 1
      var headRow = request.parameter.header_row || 1;
      var headers = scoreSheet.getRange(1, 1, 1, scoreSheet.getLastColumn()).getValues()[0];
      
      // The row we will post the submitted score
      var nextRow = scoreSheet.getLastRow() + 1; // get next row
      
      // Populate the new row data from the request
      var row = [];
      for (i in headers) {          // loop through the header columns
        if (headers[i] == "date") { // special case if you include a 'Timestamp' column
          row.push(new Date());
        } else if (request.parameter[headers[i]]) {
          // else use header name to get data
          row.push(request.parameter[headers[i]]);
        } else {
          row.push('');
        }
      }
    
      // Set the new row values.
      // more efficient to set values as [][] array than individually
      //scoreSheet.getRange(nextRow, 1, 1, row.length).setValues([row]);
      // Insert as topmost row...
      // Insert before row 2 so style comes from row 2 and not header
      // which would happen if you insertRowAfter(1)
      scoreSheet.insertRowBefore(2);
      scoreSheet.getRange(2, 1, 1, row.length).setValues([row]);
    }

    // ===== LEADERBOARD =====    
    var leaderboardSheet = doc.getSheetByName(leaderboardSheetName);
    var leaderboardRange = leaderboardSheet.getRange(2, 1, leaderboardSheet.getLastRow(), leaderboardSheet.getLastColumn());
    var leaderboardValues = leaderboardRange.getValues();

    // ===== UPDATE LEADERBOARD =====
    // If score was provided, update the leaderboard... if qualifies!
    if (isInt(score)) {
      // Loop through all teams finding a match. Undeclared folks get team=0 above
      for (var row in leaderboardValues) {
        var highTeam = leaderboardValues[row][colTeam]      
        if (highTeam == team) {                           // found my team
          if (score > leaderboardValues[row][colScore]) { // new high score!
            // update in-memory data
            leaderboardValues[row][colDate] = new Date();
            leaderboardValues[row][colScore] = score;
            leaderboardValues[row][colPlayer] = player;
            
            leaderboardRange.setValues(leaderboardValues);
            break;
          }
        }
      }
    }
    
    // ===== RETURN LEADERBOARD =====
    var leaderboard = {};
    for (var row in leaderboardValues) {
      if (isInt(leaderboardValues[row][colTeam])) {
        leaderboard[leaderboardValues[row][colTeam]] = {
          "date"  : leaderboardValues[row][colDate],
          "score" : leaderboardValues[row][colScore],
          "player": leaderboardValues[row][colPlayer],
          "campus": leaderboardValues[row][colCampus],
          "mascot": leaderboardValues[row][colMascot]
        };
      }
    }                                        
    
    var results = JSONPify(callbackFunctionName, {
      "result"     : "success", 
      "parameters" : request.parameters,
      "row"        : nextRow,
      "leaderboard": leaderboard
    });    

    return ContentService
          .createTextOutput(results)
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
    
  } catch(error) {
    var results = JSONPify(callbackFunctionName, {
      "result": "error", 
      "error" : error
    });    
    
    return ContentService
          .createTextOutput(results)
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } finally { 
    //release lock
    lock.releaseLock();
  }
}

