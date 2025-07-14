const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
// Allow requests from your frontend URL (e.g., Live Server)
app.use(cors({
  origin: 'http://127.0.0.1:5500' // Adjust this if your frontend URL is different
}));
app.use(express.json());

// IMPORTANT: Ensure this URI is correct and includes your actual password for 'rishika' user.
// The '?retryWrites=true&w=majority' part is crucial for reliable connections.
const uri = 'mongodb+srv://rishika:rishika2005@cluster1.axquqfb.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

let notesCollection;

async function start() {
  try {
    await client.connect();
    // 'notesdb' should be the name of the database you intend to use in MongoDB Atlas
    notesCollection = client.db('notesdb').collection('notes');
    console.log('Successfully connected to MongoDB Atlas!');
    app.listen(3000, () => console.log('Server running on http://localhost:3000'));
  } catch (error) {
    console.error('Failed to connect to MongoDB Atlas:', error);
    process.exit(1); // Exit the process if connection fails
  }
}
start();

// Get all notes for a user (created by user or shared with user)
app.get('/api/notes', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email query param is required' });

  try {
    const notes = await notesCollection.find({
      $or: [
        { userEmail: email },
        { sharedWith: email }
      ]
    }).toArray();
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Add a note with userEmail and sharedWith info
app.post('/api/notes', async (req, res) => {
  const { text, user, sharedWith = [] } = req.body;
  if (!user || !user.email) return res.status(400).json({ error: 'User email is required' });

  const note = {
    text,
    userEmail: user.email,
    sharedWith,
    date: new Date().toLocaleString(),
  };

  try {
    const result = await notesCollection.insertOne(note);
    res.status(201).json({ ...note, _id: result.insertedId });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Edit a note's text (requires ownership or shared access)
app.put('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  const { text, requestingUserEmail } = req.body; // requestingUserEmail is crucial for authorization

  if (!requestingUserEmail) {
    return res.status(401).json({ error: 'Authentication required: requestingUserEmail missing' });
  }

  try {
    const note = await notesCollection.findOne({ _id: new ObjectId(id) });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Check if the requesting user is the owner or is in the sharedWith list
    const hasPermission = note.userEmail === requestingUserEmail || (note.sharedWith && note.sharedWith.includes(requestingUserEmail));

    if (!hasPermission) {
      return res.status(403).json({ error: 'Permission denied to edit this note' });
    }

    await notesCollection.updateOne({ _id: new ObjectId(id) }, { $set: { text } });
    res.json({ success: true, message: 'Note updated successfully' });
  } catch (error) {
    console.error('Error editing note:', error);
    res.status(500).json({ error: 'Failed to edit note' });
  }
});

// Delete a note (requires ownership or shared access)
app.delete('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  const { requestingUserEmail } = req.body; // requestingUserEmail is crucial for authorization

  if (!requestingUserEmail) {
    return res.status(401).json({ error: 'Authentication required: requestingUserEmail missing' });
  }

  try {
    const note = await notesCollection.findOne({ _id: new ObjectId(id) });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Check if the requesting user is the owner or is in the sharedWith list
    const hasPermission = note.userEmail === requestingUserEmail || (note.sharedWith && note.sharedWith.includes(requestingUserEmail));

    if (!hasPermission) {
      return res.status(403).json({ error: 'Permission denied to delete this note' });
    }

    await notesCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// New endpoint to share a note with another user
app.put('/api/notes/:id/share', async (req, res) => {
  const { id } = req.params;
  const { emailToShareWith, requestingUserEmail } = req.body; // requestingUserEmail for authorization

  if (!emailToShareWith || !requestingUserEmail) {
    return res.status(400).json({ error: 'Email to share with and requestingUserEmail are required' });
  }

  try {
    const note = await notesCollection.findOne({ _id: new ObjectId(id) });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Only the owner can share their note
    if (note.userEmail !== requestingUserEmail) {
      return res.status(403).json({ error: 'Only the note owner can share this note' });
    }

    await notesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $addToSet: { sharedWith: emailToShareWith } } // $addToSet prevents duplicate emails
    );
    res.json({ success: true, message: `Note shared with ${emailToShareWith}` });
  } catch (error) {
    console.error('Error sharing note:', error);
    res.status(500).json({ error: 'Failed to share note' });
  }
});

// Mock user endpoint (for testing purpose, you should implement real auth)
app.get('/api/user', (req, res) => {
  res.json({ email: 'rishika@example.com', name: 'Rishika' });
});