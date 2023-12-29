import logo from './logo.svg';
import './App.css';
//import demoVideo from '/test.mov';
import { Bars } from 'react-loader-spinner'
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {dark} from "react-syntax-highlighter/dist/esm/styles/prism"
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { stripHtml } from "string-strip-html";
import { createTheme, responsiveFontSizes, ThemeProvider } from '@mui/material/styles';

const apiUrl = 'http://127.0.0.1:5000'
const theme = createTheme({
  palette: {
    primary: {
      main: '#005e9c',
      light: '#4791db',
      dark: '#005e9c',
      contrastText: '#fff',
    },
    secondary: {
      main: '#f50057',
      light: '#ff4081',
      dark: '#c51162',
      contrastText: '#fff',
    }
  },
  typography: {
    fontFamily: 'Helvetica',
    h1: {
      fontWeight: 600,
      fontSize: '4.5rem',
      lineHeight: '2',
      letterSpacing: '-0.01562em',
      spacing: '1rem'
    },
    h2: {
      fontWeight: 900,
      fontSize: '2rem',
      lineHeight: '2',
      letterSpacing: '-0.00833em',
      paddingTop: '.5rem'
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.2rem',
      lineHeight: '1.2',
      letterSpacing: '-0.00833em',
    },
    body1: {
      fontWeight: 400,
      fontSize: '1rem',
      lineHeight: '1.5',
      letterSpacing: '0.00938em',
    },
    body2: {
      fontWeight: 400,
      fontSize: '0.7rem',
      lineHeight: '1.5',
      letterSpacing: '0.01071em',
    },
    topMenuBoxes: {
      flex: 1,
      textAlign: "center"
    }
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: '5px',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          borderRadius: '5px',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderBottom: '2px solid #ccc',
          '&:last-of-type': {
            borderBottom: 'none',
          },
        },
      },
    },
  },
});

responsiveFontSizes(theme)

function App() {
  const [renderable, setRenderable] = useState(false);
  const [story, setStory] = useState(null);
  const [children, setChildren] = useState([]);
  const [childrenById, setChildrenById] = useState({});
  const [loading, setLoading] = useState(false)
  
  useEffect( () => {
    async function fetchData() {
      let result = await retrieveStory();
      setStory(result);
    }
    fetchData();
	}, [])

  useEffect(() => {
    if(story && story.kids && story.kids.length > 0) {
      getChildItems(story).then((childItems) => {
        let curChildrenById = {}
        childItems.forEach((child) => {
          curChildrenById[child.id] = child;
        });
        setChildren(childItems);
        setChildrenById(curChildrenById);
      })
    }
  }, [story]);

  useEffect(() => {
    if(Array.isArray(children) && children.length > 0)
      setRenderable(true)
    else
      console.log(children)
  }, [children])

  const handleSearch = (event) => {
    // Perform search request
    event.preventDefault();
    setLoading(true);
    console.log('Searching for:', event.target.search.value);
    var bodyFormData = new FormData();
    bodyFormData.append('question', event.target.search.value);

    let response = axios.post(`${apiUrl}/ask`, bodyFormData).then(response => {
      console.log(`children: ${JSON.stringify(response,0,4)}`);
      let newChildren = response.data.searchResults.map((listingId) => {
        //update the children with the response comment ID
        return childrenById[listingId];
      })
      setChildren(newChildren); 
      setLoading(false);    
    });
  }

    return (
      <Router>
        <ThemeProvider theme={theme}>
          <AppBar position="static">
            <Toolbar sx={{textAlign: "center", justifyContent: "center"}}>
              <Button color="inherit" component={Link} to="/">
                Demo
              </Button>
              <Button color="inherit" component={Link} to="https://github.com">
                Github
              </Button>
            </Toolbar>
          </AppBar>
          <Container maxWidth="md">
            <Routes>
              {renderable ? (
                <Route exact path="/" element = {
                  <Demo
                    loading = {loading}
                    handleSearch={handleSearch}
                    renderable={renderable}
                    story={story}
                    children={children}
                  />
                }/>
              ) : ( 
                <Route exact path="/" element = {
                  <Bars
                    visible={true}
                    color="#005e9c"
                    height="80"
                    width="80"
                    ariaLabel="dna-loading"
                    wrapperStyle={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
                    wrapperClass="bars-wrapper"
                  />
                }/>
              )}
            </Routes>
          </Container>
        </ThemeProvider>
      </Router>
    );

}

function Demo( props ) {
  const { handleSearch, loading, renderable, story, children } = props;
  return (
  <Container maxWidth="lg">
    <Typography variant="h2" gutterBottom>
      Who's Hiring AI Search
    </Typography>
    <form onSubmit={handleSearch} sx={{ m: 1, flexGrow: 1 }}>     
      <Stack direction="row" alignItems="center" spacing={2}>
        <TextField
          id="search"
          name="search"
          label="Search"
          variant="outlined"
          size="small"
          fullWidth
        />            
          <div>
            { 
              loading ? 
                <Bars
                  visible={true}
                  height="40"
                  width="90"
                  color="#005e9c"
                  ariaLabel="bars-loading"
                  wrapperStyle={{ }}
                  wrapperClass="bars-wrapper"
                /> : 
                <Button type="submit" variant="contained">
                  Search
                </Button>
            }
          </div>
      </Stack>
    </form>
    {renderable ? (
      <List>
        <>
        <ListItem>
          <ListItemText primary={story.title} secondary={`by ${story.by}`} />
        </ListItem>
        <List>
          {
            children.map((child) => (
              <ListItem key={child.id}>
                <ListItemText primary={`${child.text}`} secondary={`by ${child.by}`} />
              </ListItem>
            ))
          }
        </List>
        </>
      </List>
      ) : (
      <Typography>Loading...</Typography>
    )}
  </Container>)
}

async function getChildItems(story) {
    console.log(`${JSON.stringify(story)}`);
    const childrenUrls = story.kids.map((kidId) => `https://hacker-news.firebaseio.com/v0/item/${kidId}.json`);
    const childrenResponses = await Promise.all(childrenUrls.map((url) => axios.get(url)));
    console.log(childrenResponses);
    const childMap = await Promise.all(childrenResponses.map((response) => {
      let data = response.data;
      console.log(data);
      if(data.text && data.text !== undefined) {
        let strippedText = stripHtml(data.text);
        data.text = strippedText.result;
      }
      return data;
    }));
    console.log(childMap);
    return childMap;
}

async function retrieveStory() {
  const result = await axios.get(`${apiUrl}/getStories`)
  const storyId = result.data.stories[0]
  // for now story ID only returns a single result
  const storyUrl = `https://hacker-news.firebaseio.com/v0/item/${storyId}.json`;
  const storyResponse = await axios.get(storyUrl);
  const story = storyResponse.data;
  
  if (!story || story.type !== 'story') {
    throw new Error(`Invalid story with ID ${storyId}`);
  }

  return story;
}

export default App;
