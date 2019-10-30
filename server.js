//-------------------------------
// Load the libraries
//-------------------------------
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const mysql = require('mysql');
const hbs = require('express-handlebars');
const express = require('express');

const config = require('./config');
console.log('>> config "', config);

//-------------------------------
// Configure the applications
//-------------------------------
const PORT = parseInt(process.argv[2] | process.env.APP_PORT) || 3000;

const app = express();

//Queries - adopt a naming converntion; <VERBS>_<TABLE_NAME>_<TERM>
const SEARCH_TV_SHOW_BY_SUMMARY = 'Select * from tv_shows where summary like ?';
const GET_TV_SHOW_BY_TVID = 'Select name, summary from tv_shows where tvid = ?';

// Configure MYSQL connection pool
const pool = mysql.createPool(config);  // alternatively>> mysql.createPool(require('./config'));
let dbIsAlive = false;

// Configure handlebars
app.engine('hbs', hbs({ defaultLayout: 'main.hbs' }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Configure Cors & Morgan
app.use(cors());
app.use(morgan('tiny'));

app.use((req, res, next) => {
    if (dbIsAlive) {
        return next();
    } else {
        res.status(503);
        res.format({
            'application/json': () => {
                res.type('application/json')
                    .json({
                        message: 'Server is not available'
                    })
            },
            'default': () => {
                res.type('text/html')
                    .render('server_not_available');
            }
        })
    }
})

//-------------------------------
// Application routes
//-------------------------------

// GET /api/tv_shows/search?q=
//  q search the summary field
app.get('/api/tv_shows/search', (req, res) => {
    const q = req.query.q;

    if (!q) {
        res.format({
            'application/json': () => {
                res.status(400).type('application/json')
                    .json({
                        error: 'There is no search term'
                    })
            },
            'text/html': () => {
                res.status(400).type('text/html')
                    .send('<p>There is no search term</p>')
            },
            'default': () => {
                res.status(400).type('text/html')
                    .send('<p>There is no search term</p>')
            }
        })
        return;
    }

    // Get connection
    pool.getConnection((err, conn) => {
        // Error handling
        if (err)
            return res.format({
                'application/json': () => {
                    res.status(500).type('application/json')
                        .json({
                            error: JSON.stringify(err)
                        })
                },
                'text/html': () => {
                    res.status(500).type('text/html')
                        .send('<p>Server connection error</p>')
                },
                'default': () => {
                    res.status(500).type('text/html')
                        .send('<p>Server connection error</p>')
                }
            })

        // Make query
        conn.query(
            SEARCH_TV_SHOW_BY_SUMMARY,
            [`%${q}%`],
            (err, result) => {
                conn.release(); //release connection

                // Error Handling
                if (err)
                    return res.format({
                        'application/json': () => {
                            res.status(500).type('application/json')
                                .json({
                                    error: JSON.stringify(err)
                                })
                        },
                        'text/html': () => {
                            res.status(500).type('text/html')
                                .send('<p>Database error</p>')
                        },
                        'default': () => {
                            res.status(500).type('text/html')
                                .send('<p>Database error</p>')
                        }
                    })

                // Response result
                res.format({
                    'application/json': () => {
                        const processed = result.map( item => {
                            return {
                                url: `/api/tv_shows/${item.tvid}`,
                                name: item.name
                            }
                        })
                        res.status(200).type('application/json')
                            .json(processed);
                    },
                    'default': () => {
                        res.status(200).type('text/html')
                            .render('search_by_summary', {
                                result: result
                            });
                    }
                })
            }
        )
    })
})

// GET TV SHOW BY TVID
app.get('/api/tv_shows/:tvid', (req, res) => {
    const tvid = req.params.tvid;

    // Get connection
    pool.getConnection((err, conn) => {
        // Error handling
        if (err)
            return res.format({
                'application/json': () => {
                    res.status(500).type('application/json')
                        .json({
                            error: JSON.stringify(err)
                        })
                },
                'text/html': () => {
                    res.status(500).type('text/html')
                        .send('<p>Server connection error</p>')
                },
                'default': () => {
                    res.status(500).type('text/html')
                        .send('<p>Server connection error</p>')
                }
            })

        // Make query
        conn.query(
            GET_TV_SHOW_BY_TVID,
            [tvid],
            (err, result) => {
                conn.release(); //release connection

                // Error Handling
                if (err)
                    return res.format({
                        'application/json': () => {
                            res.status(500).type('application/json')
                                .json({
                                    error: JSON.stringify(err)
                                })
                        },
                        'text/html': () => {
                            res.status(500).type('text/html')
                                .send('<p>Database error</p>')
                        },
                        'default': () => {
                            res.status(500).type('text/html')
                                .send('<p>Database error</p>')
                        }
                    })

                if (result.length > 0) {
                    // Response result
                    res.format({
                        'application/json': () => {
                            res.status(200).type('application/json')
                                .json(result);
                        },
                        'default': () => {
                            res.status(200).type('text/html')
                                .render('search_by_summary', {
                                    result: result
                                });
                        }
                    })
                } else {
                    res.status(404).type('application/json')
                        .json({
                            message: 'Page Not Found',
                            id: tvid
                        });
                }
            }
        )
    })
})

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));


//-------------------------------
// Start the server
//-------------------------------
pool.getConnection((err, conn) => {
    // Start the server 
    app.listen(PORT, () => {
        console.log(`Application started on Port ${PORT} at ${new Date()}`);
    })

    // Error handling
    if (err) {
        dbIsAlive = !err;
        console.log(`Database is alive: ${dbIsAlive}`);
    } else {
        conn.ping((err) => {
            conn.release();
            dbIsAlive = !err;
            console.log(`Database is alive: ${dbIsAlive}`);
        })
    }
})