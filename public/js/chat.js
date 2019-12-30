//jshint esversion:6
const socket=io();
const $messageForm=document.querySelector("#message-form");
const $messageFormInput=document.querySelector("#message-form-input");
const $messageFormButton=document.querySelector("#message-form-button");
const $messages=document.querySelector("#messages");

const messageTemplate=document.querySelector("#message-template").innerHTML;
const myMessageTemplate=document.querySelector("#my-message-template").innerHTML;
const welcomeMessageTemplate=document.querySelector("#welcome-message-template").innerHTML;
const user=document.querySelector("#username").innerHTML;

const autoscroll=()=>{
  $messages.scrollTop=$messages.scrollHeight;
};

socket.on('welcome',(message)=>{
  //console.log(message);
  const html=Mustache.render(welcomeMessageTemplate,{message});

  $messages.insertAdjacentHTML('beforeend',html);
  autoscroll();
});

socket.on('message',(message)=>{
  //console.log(message);
  const html=Mustache.render(messageTemplate,{
    message:message.text.text,
    createdAt:moment(message.text.createdAt).format('h:mm a'),
    user:user
  });
  $messages.insertAdjacentHTML('beforeend',html);
  autoscroll();
});

socket.on('my-message',(message)=>{
  //console.log(message);
  const html=Mustache.render(myMessageTemplate,{
    message:message.text.text,
    createdAt:moment(message.text.createdAt).format('h:mm a'),
    user:user
  });
  $messages.insertAdjacentHTML('beforeend',html);
  autoscroll();
});

$messageForm.addEventListener('submit',(e)=>{
  e.preventDefault();
  $messageFormButton.setAttribute('disabled','disabled');
  
  const message={
    text:e.target.elements.message.value,
    user:user
  };
  $messageFormInput.focus();
  socket.emit('sendMessage',message,(message)=>{
    $messageFormButton.removeAttribute('disabled');
    $messageFormInput.value='';
    //console.log(message);
  });
});


document.querySelector("#pills-chat-tab").addEventListener('click',()=>{
  socket.emit('welcome',user);
});
