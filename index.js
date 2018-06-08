const axios = require("axios");
const express = require("express");
const cors = require("cors");

const GITHUB_STAR_PROJECT = "github-list/github-list.github.io";

require('dotenv').config()

const get = (url, ...rest) => axios.get(url+`?client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}`);
const app = express();

app.use(cors())

const getDataFromRepo = (repo) => (
  {
  	id: repo.id,
    name: repo.full_name,
    url: repo.html_url,
    createdAt: repo.created_at,
    fork: repo.fork,
    description: repo.description,
    language: repo.language,
    stars: repo.stargazers_count,
  }
);

app.get("/user/:user/check", async (req, res) => {
  try {
    const { data: stargazers } = await get(`https://api.github.com/repos/${GITHUB_STAR_PROJECT}/stargazers`);
    const username = req.params.user;
    if ( stargazers.findIndex(({login}) => login === username) < 0 ) {
      return res.json({
        ok: false,
        error: "Not starred"
      })
    }
  
    return res.json({
      ok: true,
    });
  } catch (e) {
    console.error(e);
    if ( e.code === "ENOTFOUND" && e.hostname === "api.github.com" ){
      return res.status(500).json({
        ok: false,
        error: "GitHub error"
      })
    }

    return res.status(500).json({
      ok: false,
      error: "Internal error"
    })
  }
})
app.get("/user/:user", async (req, res) => {
  try {
    const { data: stargazers } = await get(`https://api.github.com/repos/${GITHUB_STAR_PROJECT}/stargazers`);
    const username = req.params.user;
    if ( stargazers.findIndex(({login}) => login === username) < 0 ) {
      return res.status(403).json({
        ok: false,
        error: "Not starred"
      })
    }

    const sortBy = req.query.sort || "created";
    const sortDirection = req.query.direction || "desc";

    const {data: userUrls} = await get(`https://api.github.com/users/${username}`);

    const {data: repos} = await get(userUrls.repos_url);
    const {data: organizations} = await get(userUrls.organizations_url);
    
    const organizationsRepos = (await Promise.all(organizations.map(org => get(org.repos_url)))).map(({data}) => data);
    
    const organizationsReposFlatten = [].concat(...organizationsRepos);
    const organizationsReposCollaborators = await Promise.all(organizationsReposFlatten.map(repo => get(repo.contributors_url)));

    const organizationsUserRepos = [];

    organizationsReposCollaborators.forEach(({data: col}, i) => {
      if ( col.findIndex(({login}) => login === username) >= 0 ) {
        const repo = organizationsReposFlatten[i];
        organizationsUserRepos.push(getDataFromRepo(repo));
      }
    });

    const userRepos = repos.map(repo => getDataFromRepo(repo));

    let allRepos = [...userRepos, ...organizationsUserRepos];

    if (sortBy === "created") {
      const isDesc = (sortDirection === "desc") ? -1 : 1;
      allRepos = allRepos.sort((a, b) => {
        const aDate = new Date(a.createdAt);
        const bDate = new Date(b.createdAt);

        return (aDate - bDate) * isDesc;
      })
    }

    return res.json( {
      ok: true,
      repos: allRepos,
      userData: {}
    } );
  } catch (e) {
    console.error(e);
    if ( e.code === "ENOTFOUND" && e.hostname === "api.github.com" ){
      return res.status(500).json({
        ok: false,
        error: "GitHub error"
      })
    }

    return res.status(500).json({
      ok: false,
      error: "Internal error"
    })
  }
})

app.listen(process.env.PORT, () => {
  console.log("App is running on port " + process.env.PORT);
})
